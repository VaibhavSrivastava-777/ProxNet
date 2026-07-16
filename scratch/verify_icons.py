import os
from PIL import Image

def verify_file(path, expected_width, expected_height):
    if not os.path.exists(path):
        print(f"FAIL: File does not exist: {path}")
        return False
    try:
        with Image.open(path) as img:
            w, h = img.size
            if w == expected_width and h == expected_height:
                print(f"PASS: {path} is {w}x{h}")
                return True
            else:
                print(f"FAIL: {path} has size {w}x{h}, expected {expected_width}x{expected_height}")
                return False
    except Exception as e:
        print(f"FAIL: Error reading {path}: {e}")
        return False

def verify_manifest():
    manifest_path = "android/app/src/main/AndroidManifest.xml"
    if not os.path.exists(manifest_path):
        print("FAIL: AndroidManifest.xml not found")
        return False
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    has_icon = 'android:icon="@mipmap/ic_launcher"' in content
    has_round_icon = 'android:roundIcon="@mipmap/ic_launcher_round"' in content
    
    if has_icon and has_round_icon:
        print("PASS: AndroidManifest.xml has correct icon and roundIcon references.")
        return True
    else:
        print(f"FAIL: AndroidManifest.xml checks failed. has_icon={has_icon}, has_round_icon={has_round_icon}")
        return False

def main():
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }
    
    all_ok = True
    res_base_dir = "android/app/src/main/res"
    
    for folder, size in densities.items():
        icon_path = os.path.join(res_base_dir, folder, "ic_launcher.png")
        round_path = os.path.join(res_base_dir, folder, "ic_launcher_round.png")
        
        if not verify_file(icon_path, size, size):
            all_ok = False
        if not verify_file(round_path, size, size):
            all_ok = False
            
    if not verify_manifest():
        all_ok = False
        
    if all_ok:
        print("Verification: ALL TESTS PASSED SUCCESSFULLY!")
    else:
        print("Verification: SOME TESTS FAILED!")

if __name__ == "__main__":
    main()
