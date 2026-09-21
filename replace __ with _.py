from pathlib import Path

# Folder where this Python script is located
root_folder = Path(__file__).resolve().parent

# Years to process
years = range(1997, 2025)

files_changed = 0

for year in years:
    year_folder = root_folder / str(year)

    if not year_folder.is_dir():
        continue

    # Check all JSON files inside the year folder and its subfolders
    for json_file in year_folder.rglob("*.json"):
        try:
            # Read file
            content = json_file.read_text(encoding="utf-8")

            # Replace double underscores with a single underscore
            new_content = content.replace("__", "_")

            # Only write if something actually changed
            if new_content != content:
                json_file.write_text(new_content, encoding="utf-8")
                files_changed += 1
                print(f"Updated: {json_file}")

        except Exception as e:
            print(f"ERROR: {json_file}")
            print(f"       {e}")

print()
print(f"Finished. {files_changed} JSON files changed.")
