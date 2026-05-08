from PIL import Image
import os

# folder where script is located
folder = os.getcwd()

# supported formats
extensions = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp")

for filename in os.listdir(folder):
    if filename.lower().endswith(extensions):
        filepath = os.path.join(folder, filename)

        try:
            with Image.open(filepath) as img:
                # calculate new size (50%)
                new_size = (img.width // 2, img.height // 2)

                # resize
                resized = img.resize(new_size, Image.LANCZOS)

                # overwrite original file (or change name if you prefer)
                resized.save(filepath)

                print(f"Resized: {filename} -> {new_size}")

        except Exception as e:
            print(f"Failed: {filename} ({e})")
