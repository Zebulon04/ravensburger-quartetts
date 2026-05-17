import os
import json
from collections import defaultdict

# Output file
OUTPUT_FILE = "grouped_cards_extended.json"

# Dictionary for grouping
grouped_data = defaultdict(list)

# Walk through all subfolders
for root, dirs, files in os.walk("."):
    for file in files:
        if file.lower().endswith(".json"):
            filepath = os.path.join(root, file)

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                year = data.get("year")
                collection = data.get("collection")

                # Group key
                key = (year, collection)

                # Add cards
                for card in data.get("cards", []):

                    # Start with required fields
                    extracted_card = {
                        "card": card.get("card"),
                        "name": card.get("name")
                    }

                    # Optional fields (only add if not empty)
                    optional_fields = [
                        "info_left",
                        "info_right",
                        "info_image"
                    ]

                    for field in optional_fields:
                        value = card.get(field)

                        # Ignore None, empty strings, whitespace-only strings
                        if value is not None and str(value).strip() != "":
                            extracted_card[field] = value

                    grouped_data[key].append(extracted_card)

            except Exception as e:
                print(f"Error reading {filepath}: {e}")

# Convert grouped data into final structure
final_output = []

for (year, collection), cards in grouped_data.items():
    final_output.append({
        "year": year,
        "collection": collection,
        "cards": cards
    })

# Optional sorting
final_output.sort(key=lambda x: (x["year"], x["collection"]))

# Save result
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(final_output, f, ensure_ascii=False, indent=2)

print(f"Done! Created {OUTPUT_FILE}")
