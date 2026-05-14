import os
import sys
from PIL import Image
from pathlib import Path

# Target aspect ratios (Width / Height)
TARGET_RATIOS = {"4:5": 4/5, "1:1": 1/1, "1.91:1": 1.91/1, "9:16": 9/16}

def main():
    # Detect where the portable executable is currently sitting
    if getattr(sys, 'frozen', False):
        base_path = Path(sys.executable).parent
    else:
        base_path = Path(__file__).parent

    print(f"Scanning folder recursively: {base_path}")
    
    output_folder = base_path / "Padded_Output"
    
    found_images = False
    
    # Use rglob to recursively find all PNGs in all subfolders
    for img_path in base_path.rglob('*.png'):
        
        # Skip any images that are already inside the Padded_Output folder
        if output_folder in img_path.parents:
            continue

        found_images = True
        print(f"\nProcessing: {img_path.name}")
        
        try:
            with Image.open(img_path) as img:
                img = img.convert("RGB")
                orig_w, orig_h = img.size
                
                best_ratio_name, best_area, best_dimensions = None, float('inf'), (0, 0)
                
                # Test all ratios
                for ratio_name, ratio_val in TARGET_RATIOS.items():
                    if (orig_w / orig_h) > ratio_val:
                        new_w, new_h = orig_w, int(orig_w / ratio_val)
                    else:
                        new_w, new_h = int(orig_h * ratio_val), orig_h
                        
                    if (new_w * new_h) < best_area:
                        best_area = new_w * new_h
                        best_dimensions = (new_w, new_h)
                        best_ratio_name = ratio_name
                
                # Create background and paste
                new_w, new_h = best_dimensions
                background = Image.new('RGB', (new_w, new_h), (0, 0, 0))
                offset_x, offset_y = (new_w - orig_w) // 2, (new_h - orig_h) // 2
                background.paste(img, (offset_x, offset_y))
                
                # REPLICATE THE FOLDER STRUCTURE
                # Get the relative path of the image compared to the base folder
                rel_path = img_path.relative_to(base_path)
                
                # Construct the final output path
                out_path = output_folder / rel_path
                
                # Create any necessary subdirectories in the output folder
                out_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Save
                background.save(out_path, "PNG")
                print(f"  -> Saved as {best_ratio_name} to {rel_path}")
                
        except Exception as e:
            print(f"  -> Error: {e}")

    if not found_images:
        print("\nNo PNG files found in this folder or subfolders!")
        
    print("\nProcess complete. You can close this window.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()