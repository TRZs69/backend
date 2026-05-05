import re
import json

def extract_data(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the COPY sections
    sections = re.findall(r'COPY public\.(\w+).*?FROM stdin;(.*?)\\\.', content, re.DOTALL)
    data = {table: rows.strip().split('\n') for table, rows in sections}
    return data

def parse_row(row):
    return row.split('\t')

def main():
    raw_data = extract_data('graphci_2026-03-05.sql')
    
    target_chapters = set(['8', '10', '11', '12', '13', '14', '15', '16'])
    
    output_sql = []
    output_sql.append("-- Migration script for Chapters 8-16\n")
    output_sql.append("SET FOREIGN_KEY_CHECKS = 0;\n")

    # 1. Chapters
    output_sql.append("-- Chapters")
    for row in raw_data.get('chapters', []):
        cols = parse_row(row)
        if cols[0] in target_chapters:
            # id, name, description, level, courseId, isCheckpoint, createdAt, updatedAt
            vals = [cols[0], f"'{cols[1]}'", f"'{cols[2]}'", cols[3], cols[4], cols[5], f"'{cols[6]}'", f"'{cols[7]}'"]
            output_sql.append(f"INSERT INTO chapters (id, name, description, level, courseId, isCheckpoint, createdAt, updatedAt) VALUES ({', '.join(vals)}) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), level=VALUES(level), courseId=VALUES(courseId), isCheckpoint=VALUES(isCheckpoint), updatedAt=VALUES(updatedAt);")

    # 2. Materials
    output_sql.append("\n-- Materials")
    for row in raw_data.get('materials', []):
        cols = parse_row(row)
        if cols[1] in target_chapters:
            # id, chapterId, name, content, createdAt, updatedAt
            content_escaped = cols[3].replace("'", "''").replace("\\n", "\n")
            vals = [cols[0], cols[1], f"'{cols[2]}'", f"'{content_escaped}'", f"'{cols[4]}'", f"'{cols[5]}'"]
            output_sql.append(f"INSERT INTO materials (id, chapterId, name, content, createdAt, updatedAt) VALUES ({', '.join(vals)}) ON DUPLICATE KEY UPDATE chapterId=VALUES(chapterId), name=VALUES(name), content=VALUES(content), updatedAt=VALUES(updatedAt);")

    # 3. Assessments & Questions
    output_sql.append("\n-- Assessments & Questions")
    assessment_id_map = {} # Postgres Assessment ID -> Chapter ID
    
    for row in raw_data.get('assessments', []):
        cols = parse_row(row)
        if cols[1] in target_chapters:
            # id, chapterId, instruction, questions, answers, createdAt, updatedAt
            assessment_id = cols[0]
            chapter_id = cols[1]
            instruction = cols[2].replace("'", "''")
            created_at = cols[5]
            updated_at = cols[6]
            
            vals = [assessment_id, chapter_id, f"'{instruction}'", f"'{created_at}'", f"'{updated_at}'"]
            output_sql.append(f"INSERT INTO assessments (id, chapterId, instruction, createdAt, updatedAt) VALUES ({', '.join(vals)}) ON DUPLICATE KEY UPDATE chapterId=VALUES(chapterId), instruction=VALUES(instruction), updatedAt=VALUES(updatedAt);")
            
            # Parse questions
            try:
                questions_json = json.loads(cols[3].replace('\\"', '"').replace('\\\\', '\\'))
                for q in questions_json:
                    q_text = q.get('question', '').replace("'", "''")
                    q_type = q.get('type', 'MC').replace("'", "''")
                    q_options = json.dumps(q.get('options', [])).replace("'", "''")
                    q_answer = q.get('answer', '').replace("'", "''")
                    
                    # AssessmentId in questions table
                    q_vals = [assessment_id, f"'{q_text}'", f"'{q_type}'", f"'{q_options}'", f"'{q_answer}'", f"'{created_at}'", f"'{updated_at}'"]
                    output_sql.append(f"INSERT INTO questions (assessmentId, question, type, options, answer, createdAt, updatedAt) VALUES ({', '.join(q_vals)});")
            except Exception as e:
                output_sql.append(f"-- Error parsing questions for assessment {assessment_id}: {str(e)}")

    # 4. Assignments
    output_sql.append("\n-- Assignments")
    for row in raw_data.get('assignments', []):
        cols = parse_row(row)
        if cols[1] in target_chapters:
            # id, chapterId, instruction, fileUrl, createdAt, updatedAt
            instruction = cols[2].replace("'", "''").replace("\\n", "\n")
            vals = [cols[0], cols[1], f"'{instruction}'", f"'{cols[3]}'", f"'{cols[4]}'", f"'{cols[5]}'"]
            output_sql.append(f"INSERT INTO assignments (id, chapterId, instruction, fileUrl, createdAt, updatedAt) VALUES ({', '.join(vals)}) ON DUPLICATE KEY UPDATE chapterId=VALUES(chapterId), instruction=VALUES(instruction), fileUrl=VALUES(fileUrl), updatedAt=VALUES(updatedAt);")

    output_sql.append("\nSET FOREIGN_KEY_CHECKS = 1;")

    with open('final_migration_8_16.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_sql))

if __name__ == "__main__":
    main()
