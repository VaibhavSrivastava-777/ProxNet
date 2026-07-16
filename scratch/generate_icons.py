import os
from PIL import Image, ImageDraw

def crop_to_circle(img):
    # Ensure image is in RGBA mode for transparency
    img = img.convert("RGBA")
    
    # Create circular mask
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + img.size, fill=255)
    
    # Create empty transparent canvas
    output = Image.new("RGBA", img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0), mask=mask)
    return output

def main():
    src_path = "public/logo.png"
    if not os.path.exists(src_path):
        print(f"Error: Source file {src_path} not found.")
        return

    img = Image.open(src_path)
    print(f"Loaded logo.png: size={img.size}, mode={img.mode}")
    
    # Define densities and their target square dimensions
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }
    
    res_base_dir = "android/app/src/main/res"
    os.makedirs(res_base_dir, exist_ok=True)
    
    for folder_name, size in densities.items():
        target_dir = os.path.join(res_base_dir, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        # 1. Generate regular square/rounded launcher icon
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        icon_path = os.path.join(target_dir, "ic_launcher.png")
        resized_img.save(icon_path, "PNG")
        print(f"Saved {icon_path} ({size}x{size})")
        
        # 2. Generate circular launcher icon
        round_img = crop_to_circle(resized_img)
        round_icon_path = os.path.join(target_dir, "ic_launcher_round.png")
        round_img.save(round_icon_path, "PNG")
        print(f"Saved {round_icon_path} ({size}x{size})")

if __name__ == "__main__":
    main()
