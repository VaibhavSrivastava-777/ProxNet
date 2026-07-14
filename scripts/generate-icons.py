import os
from PIL import Image, ImageOps

logo_path = "public/logo.png"
icons_dir = "public/icons"

if not os.path.exists(icons_dir):
    os.makedirs(icons_dir)

# Load original logo
img = Image.open(logo_path)

# Standard sizes
sizes = [48, 72, 96, 144, 192, 512]
for size in sizes:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(icons_dir, f"icon-{size}.png"), "PNG")
    print(f"Generated icon-{size}.png")

# Generate shortcut icons (96x96)
shortcut_sizes = ["shortcut-chat.png", "shortcut-forum.png"]
for name in shortcut_sizes:
    resized = img.resize((96, 96), Image.Resampling.LANCZOS)
    resized.save(os.path.join(icons_dir, name), "PNG")
    print(f"Generated {name}")

# Generate maskable icons (centered on solid #171717 background with padding)
maskable_sizes = [192, 512]
for size in maskable_sizes:
    # Background color #171717
    bg = Image.new("RGBA", (size, size), (23, 23, 23, 255))
    
    # Logo scaled down to 70% of canvas to fit in maskable safe zone
    logo_size = int(size * 0.7)
    logo_resized = img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Center the logo on the background
    offset = (size - logo_size) // 2
    bg.paste(logo_resized, (offset, offset), logo_resized if logo_resized.mode == "RGBA" else None)
    bg.save(os.path.join(icons_dir, f"maskable-{size}.png"), "PNG")
    print(f"Generated maskable-{size}.png")

print("All icons generated successfully.")
