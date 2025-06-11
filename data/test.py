import csv
import json

# Define the input and output file paths
input_file = '/Users/selvakumarmaheshwarasarma/development/lca-microservice/data/test.tsv'
output_file = '/Users/selvakumarmaheshwarasarma/development/lca-microservice/data/test.json'

# Read the TSV file and convert it to a list of dictionaries
data = []
with open(input_file, newline='') as tsvfile:
    reader = csv.DictReader(tsvfile, fieldnames=["countryOfOrigin", "materialClass", "specificMaterial", "EmissionFactor"], delimiter='\t')
    for row in reader:
        try:
            row["EmissionFactor"] = float(row["EmissionFactor"])  # Convert EmissionFactor to float
            data.append(row)
        except ValueError:
            print(f"Skipping row due to conversion error: {row}")
        
# Write the list of dictionaries to a JSON file
with open(output_file, 'w') as jsonfile:
    json.dump(data, jsonfile, indent=4)