from pathlib import Path

# Folder where this Python script is located
root_folder = Path(__file__).resolve().parent

# Ask user what to replace
old_text = input("What do you want to replace: ")
new_text = input("Replace it with: ")

# Years to process
years = range(1997, 2025)

files_changed = 0
replacements = 0

print()
print(f'Replacing "{old_text}" with "{new_text}"...')
print()

for year in years:
    year_folder = root_folder / str(year)

    if not year_folder.is_dir():
        continue

    # Check all JSON files inside the year folder and its subfolders
    for json_file in year_folder.rglob("*.json"):
        try:
            content = json_file.read_text(encoding="utf-8")

            # Replace requested text
            new_content = content.replace(old_text, new_text)

            # Only write if something actually changed
            if new_content != content:
                count = content.count(old_text)
                json_file.write_text(new_content, encoding="utf-8")

                files_changed += 1
                replacements += count

                print(f"Updated: {json_file} ({count} replacement(s))")

        except Exception as e:
            print(f"ERROR: {json_file}")
            print(f"       {e}")

print()
print("===================================")
print(f"Files changed: {files_changed}")
print(f"Total replacements: {replacements}")
print("===================================")
input("Press Enter to exit...")
