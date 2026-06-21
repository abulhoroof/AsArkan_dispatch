import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT_DIR, 'ontology.md');
const OUTPUT_PATH = path.join(ROOT_DIR, '.claude', 'ontology.json');

function parseOntology() {
  try {
    const markdown = fs.readFileSync(INPUT_PATH, 'utf-8');
    
    const ontology = {
      generatedAt: new Date().toISOString(),
      classes: [],
      relationships: [],
      lifecycles: [],
      constraints: []
    };

    let currentSection = null;
    let currentClass = null;
    let currentLifecycle = null;

    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Detect main sections
      if (line.startsWith('## 1. Core Classes')) {
        currentSection = 'classes';
        continue;
      } else if (line.startsWith('## 2. Relationships')) {
        currentSection = 'relationships';
        continue;
      } else if (line.startsWith('## 3. Lifecycles')) {
        currentSection = 'lifecycles';
        continue;
      } else if (line.startsWith('## 4. Constraints')) {
        currentSection = 'constraints';
        continue;
      }

      // Parse Classes
      if (currentSection === 'classes') {
        if (line.startsWith('### ')) {
          const className = line.replace(/### \d+\.\d+ /, '').trim();
          currentClass = { name: className, description: '', attributes: [] };
          ontology.classes.push(currentClass);
        } else if (currentClass && !line.startsWith('- **Attributes:**') && !line.startsWith('- `')) {
          if (!line.startsWith('-')) {
            currentClass.description += (currentClass.description ? ' ' : '') + line;
          }
        } else if (currentClass && line.startsWith('- `') || line.startsWith('  - `')) {
          const attrMatch = line.match(/`([^`]+)`:\s*(.*)/);
          if (attrMatch) {
            currentClass.attributes.push({ name: attrMatch[1], description: attrMatch[2] });
          } else {
             const attrFallback = line.match(/`([^`]+)`/);
             if (attrFallback) {
                currentClass.attributes.push({ name: attrFallback[1], description: line.replace(/.*`[^`]+`\s*:?\s*/, '') });
             }
          }
        }
      }

      // Parse Relationships
      if (currentSection === 'relationships') {
        if (line.startsWith('- **')) {
          // e.g., - **Driver $\rightarrow$ Loads:** (1:N) A Driver executes multiple Loads...
          const relMatch = line.match(/- \*\*([^\$]+)\s*\$\\rightarrow\$\s*([^:]+):\*\*\s*(?:\(([^)]+)\))?\s*(.*)/);
          if (relMatch) {
            ontology.relationships.push({
              source: relMatch[1].trim(),
              target: relMatch[2].trim(),
              cardinality: relMatch[3] ? relMatch[3].trim() : 'unknown',
              description: relMatch[4].trim()
            });
          }
        }
      }

      // Parse Lifecycles
      if (currentSection === 'lifecycles') {
        if (line.startsWith('### ')) {
          const name = line.replace(/### \d+\.\d+ /, '').replace(' Lifecycle', '').trim();
          currentLifecycle = { name, states: [] };
          ontology.lifecycles.push(currentLifecycle);
        } else if (currentLifecycle && line.match(/^\d+\.\s+\*\*(.*)\*\*(.*)/)) {
           const stateMatch = line.match(/^\d+\.\s+\*\*([^*]+)\*\*:?\s*(.*)/);
           if (stateMatch) {
              currentLifecycle.states.push({
                 state: stateMatch[1].trim(),
                 description: stateMatch[2].trim()
              });
           }
        }
      }

      // Parse Constraints
      if (currentSection === 'constraints') {
        if (line.startsWith('- **')) {
          const constraintMatch = line.match(/- \*\*([^*]+)\*\*:?\s*(.*)/);
          if (constraintMatch) {
             const name = constraintMatch[1].trim();
             const desc = constraintMatch[2].trim();
             ontology.constraints.push({ name, description: desc, rules: [] });
          }
        } else if (line.startsWith('  - ') && ontology.constraints.length > 0) {
             ontology.constraints[ontology.constraints.length - 1].rules.push(line.replace('  - ', '').trim());
        }
      }
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(ontology, null, 2));
    console.log(`Successfully built ontology JSON at ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('Failed to parse ontology.md:', err);
    process.exit(1);
  }
}

parseOntology();
