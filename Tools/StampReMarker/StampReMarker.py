import os
import cv2
import numpy as np
from PIL import Image
import sys
import shutil

def get_base_path():
    """ Handles path resolution whether running as script or frozen PyInstaller executable """
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def remove_black_outline(img_pil, black_threshold=40):
    """ Converts dark/black pixels to transparent """
    img_rgba = img_pil.convert("RGBA")
    data = np.array(img_rgba)
    
    r, g, b, a = data.T
    black_areas = (r < black_threshold) & (g < black_threshold) & (b < black_threshold) & (a > 0)
    data[..., 3][black_areas.T] = 0
    
    return Image.fromarray(data)

def get_stamp_match(target_image_path, original_stamp_path):
    """ Returns the match coordinates and the confidence value """
    target_img = cv2.imread(target_image_path, cv2.IMREAD_UNCHANGED)
    stamp_img = cv2.imread(original_stamp_path, cv2.IMREAD_UNCHANGED)

    if target_img is None or stamp_img is None:
        return None, 0.0, 0, 0

    if len(target_img.shape) == 3 and target_img.shape[2] == 4:
        target_gray = cv2.cvtColor(target_img, cv2.COLOR_BGRA2GRAY)
    else:
        target_gray = cv2.cvtColor(target_img, cv2.COLOR_BGR2GRAY)
        
    if len(stamp_img.shape) == 3 and stamp_img.shape[2] == 4:
        stamp_gray = cv2.cvtColor(stamp_img, cv2.COLOR_BGRA2GRAY)
    else:
        stamp_gray = cv2.cvtColor(stamp_img, cv2.COLOR_BGR2GRAY)

    result = cv2.matchTemplate(target_gray, stamp_gray, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    h, w = stamp_gray.shape
    x, y = max_loc
    
    # Return match coordinates, confidence score, and target image dimensions
    target_h, target_w = target_gray.shape
    return (x, y, w, h), max_val, target_w, target_h

def process_directory():
    base_dir = get_base_path()
    original_stamp_path = os.path.join(base_dir, "originalstamp.png")
    new_stamp_path = os.path.join(base_dir, "newstamp.png")
    output_base_dir = os.path.join(base_dir, "Updated_Images")

    if not os.path.exists(original_stamp_path) or not os.path.exists(new_stamp_path):
        print("Error: 'originalstamp.png' and 'newstamp.png' must be in the same directory as the app.")
        input("Press Enter to exit...")
        return

    # --- USER PROMPT FOR SIZING ---
    print("\n--- Stamp Sizing ---")
    print("1.0 = Same size")
    print("1.5 = 50% larger")
    print("0.8 = 20% smaller")
    try:
        scale_factor = float(input("Enter the size multiplier for the new stamp: "))
    except ValueError:
        print("Invalid input. Defaulting to 1.0 (same size).")
        scale_factor = 1.0

    # Load and clean the new stamp
    raw_new_stamp = Image.open(new_stamp_path)
    clean_new_stamp = remove_black_outline(raw_new_stamp)

    # --- PASS 1: CALIBRATION ---
    print("\n--- Pass 1: Calibrating Average Placement ---")
    offsets_from_br_x = []
    offsets_from_br_y = []
    
    # Look for pure matches to establish a baseline
    for root, dirs, files in os.walk(base_dir):
        if "Updated_Images" in root: # Skip our output directory
            continue
            
        for file in files:
            if file.lower().endswith(".png") and file not in ["originalstamp.png", "newstamp.png"]:
                target_img_path = os.path.join(root, file)
                match_coords, confidence, target_w, target_h = get_stamp_match(target_img_path, original_stamp_path)
                
                # Only use highly confident matches for calibration (85%+)
                if confidence > 0.85:
                    x, y, w, h = match_coords
                    # Calculate distance from the bottom right corner
                    offset_x = target_w - x
                    offset_y = target_h - y
                    offsets_from_br_x.append(offset_x)
                    offsets_from_br_y.append(offset_y)

    if offsets_from_br_x and offsets_from_br_y:
        avg_offset_x = int(sum(offsets_from_br_x) / len(offsets_from_br_x))
        avg_offset_y = int(sum(offsets_from_br_y) / len(offsets_from_br_y))
        print(f"Calibration successful! Found {len(offsets_from_br_x)} clean matches.")
    else:
        # Absolute fallback if NO clean matches are found anywhere
        print("Warning: Could not find any clean matches for calibration.")
        stamp_img = cv2.imread(original_stamp_path, cv2.IMREAD_UNCHANGED)
        avg_offset_x = stamp_img.shape[1] + 10 # Default rough estimate
        avg_offset_y = stamp_img.shape[0] + 10 # Default rough estimate
        print("Using standard bottom-right corner fallback.")

    # --- PASS 2: EXECUTION & MIRRORING ---
    print("\n--- Pass 2: Processing and Mirroring Folders ---")
    
    for root, dirs, files in os.walk(base_dir):
        if "Updated_Images" in root:
            continue
            
        for file in files:
            if file.lower().endswith(".png") and file not in ["originalstamp.png", "newstamp.png"]:
                target_img_path = os.path.join(root, file)
                
                # Create mirrored directory structure
                rel_path = os.path.relpath(root, base_dir)
                dest_dir = os.path.join(output_base_dir, rel_path)
                os.makedirs(dest_dir, exist_ok=True)
                dest_file_path = os.path.join(dest_dir, file)

                # Find the stamp
                match_coords, confidence, target_w, target_h = get_stamp_match(target_img_path, original_stamp_path)
                
                # Get the original stamp dimensions to calculate relative sizing
                stamp_img = cv2.imread(original_stamp_path, cv2.IMREAD_UNCHANGED)
                orig_stamp_h, orig_stamp_w = stamp_img.shape[:2]

                # Use actual find if confidence is reasonable (60%+), otherwise use average fallback
                if confidence > 0.60:
                    x, y, w, h = match_coords
                    print(f"[{confidence:.2f}] Found stamp in {file}. Replacing...")
                else:
                    x = target_w - avg_offset_x
                    y = target_h - avg_offset_y
                    w, h = orig_stamp_w, orig_stamp_h
                    print(f"[Fallback] Stamp obscured in {file}. Using average location...")

                # Apply user scaling
                new_w = int(w * scale_factor)
                new_h = int(h * scale_factor)

                # Calculate center points so the resized stamp anchors to the middle of the old one
                center_x = x + (w / 2)
                center_y = y + (h / 2)
                paste_x = int(center_x - (new_w / 2))
                paste_y = int(center_y - (new_h / 2))

                # Open the target image, resize new stamp, and paste
                target_pil = Image.open(target_img_path).convert("RGBA")
                resized_new_stamp = clean_new_stamp.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                # Paste using alpha mask
                target_pil.paste(resized_new_stamp, (paste_x, paste_y), resized_new_stamp)
                
                # Save to the new mirrored folder
                target_pil.save(dest_file_path, format="PNG")

    print("\nProcessing complete! Check the 'Updated_Images' folder.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    process_directory()