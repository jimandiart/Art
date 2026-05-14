import os
from PIL import Image

def convert_png_to_jpg(input_dir, output_dir):
    # Walk through all directories and files in the input path
    for root, dirs, files in os.walk(input_dir):
        
        # Calculate the relative path to maintain the folder structure
        rel_path = os.path.relpath(root, input_dir)
        target_dir = os.path.join(output_dir, rel_path)
        
        # Create the mirrored directories in the output destination
        os.makedirs(target_dir, exist_ok=True)

        for file in files:
            if file.lower().endswith('.png'):
                png_path = os.path.join(root, file)
                
                # Swap the .png extension for .jpg
                filename_without_ext = os.path.splitext(file)[0]
                jpg_filename = f"{filename_without_ext}.jpg"
                jpg_path = os.path.join(target_dir, jpg_filename)

                try:
                    with Image.open(png_path) as img:
                        # PNGs often have an Alpha (transparency) channel. 
                        # JPEGs don't support this, so we MUST convert to RGB.
                        # If we don't, Pillow will throw an error.
                        rgb_im = img.convert('RGB')
                        
                        # Save as JPEG with the absolute highest possible quality settings
                        rgb_im.save(jpg_path, 'JPEG', quality=100, subsampling=0)
                    
                    print(f"Success: {file} -> {jpg_filename}")
                except Exception as e:
                    print(f"Error converting {file}: {e}")

if __name__ == "__main__":
    print("-" * 50)
    print("PNG to High-Quality JPEG Directory Converter")
    print("-" * 50)
    
    in_dir = input("Drag and drop the INPUT folder here (or type the path): ").strip()
    out_dir = input("Drag and drop the OUTPUT folder here (or type the path): ").strip()

    # Clean up paths if the user dragged and dropped (Mac terminal adds trailing spaces/quotes)
    in_dir = in_dir.strip("'\" ")
    out_dir = out_dir.strip("'\" ")

    if os.path.isdir(in_dir):
        print("\nStarting conversion...\n")
        convert_png_to_jpg(in_dir, out_dir)
        print("\nConversion complete! Mirrored directory created.")
    else:
        print("\nError: The input directory you provided does not exist.")
        
    # This keeps the standalone app window open so the user can see the final results
    input("\nPress Enter to exit...")