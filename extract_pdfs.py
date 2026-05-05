import fitz
import os
import json

def extract_pdf_info(pdf_path):
    doc = fitz.open(pdf_path)
    text_data = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        text_data.append({"page": page_num + 1, "text": text})
        
        # Log images found
        image_list = page.get_images(full=True)
        text_data[page_num]["images"] = len(image_list)
        
    return text_data

pdf_files = [
    "materials/w9/W09S01-11S2224-IMK-S1IF_Prototyping-RDS.pdf",
    "materials/w10/W10S01-11S2224-IMK-S1IF-HMSAM-RDS.pdf",
    "materials/w11/W11S01-11S2224-IMK-S1IF-User_Psychology_Emotional_Design_Affordance-RDS.pdf",
    "materials/w12/IMK_GenderMag_Method_in_SE_Riyanthi.pdf",
    "materials/w13/W13S01-11S2224-IMK-S1IF-RDS.pdf",
    "materials/w13/W13S03-11S2224-IMK-S1IF-RDS.pdf"
]

all_info = {}
for pdf in pdf_files:
    print(f"Processing {pdf}...")
    all_info[pdf] = extract_pdf_info(pdf)

print(json.dumps(all_info))
