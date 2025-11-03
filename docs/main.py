"""
Code Documentation Generator
Generates PDF documentation for backend logic and business code
Excludes frontend rendering code (JSX/TSX)
Includes intelligent code explanations
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.colors import HexColor

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent
DOCS_OUTPUT = Path(__file__).parent / "backend_documentation.pdf"

# Phase 1 Files to Document
PHASE_1_FILES = [
    "convex/schema.ts",
    "convex/_generated/dataModel.d.ts",
    "src/types/index.ts",
    "convex/auth.config.ts",
    "next.config.ts",
    "vercel.json",
    "tsconfig.json",
]

# Phase 2 Files to Document
PHASE_2_FILES = [
    "convex/codeExecution.ts",
    "convex/codeExecutions.ts",
    "convex/collaboration.ts",
    "convex/sessionActivity.ts",
    "convex/sessionFiles.ts",
    "convex/sessionFolders.ts",
    "convex/files.ts",
    "convex/folders.ts",
    "convex/snippets.ts",
    "convex/users.ts",
    "convex/lemonSqueezy.ts",
    "convex/http.ts",
    "convex/crons.ts",
    "convex/migration.ts",
]

# Phase 3 Files to Document
PHASE_3_FILES = [
    "src/middleware.ts",
    "src/app/api/session-leave/route.ts",
]

# Phase 4 Files to Document (Logic from Frontend Files)
PHASE_4_FILES = [
    # Core utilities and stores
    "src/store/useCodeEditorStore.ts",
    "src/hooks/useSessionActivity.ts",
    "src/utils/sessionId.ts",
    
    # Component files with significant logic (will extract logic only)
    "src/app/(root)/_components/EditorPanel.tsx",
    "src/app/(root)/_components/OutputPanel.tsx",
    "src/app/(root)/_components/ShareSnippetDialog.tsx",
    "src/app/(root)/_components/LanguageSelector.tsx",
    "src/app/(root)/_components/ThemeSelector.tsx",
    "src/components/MultiFileEditor.tsx",
    "src/components/MultiFileEditorSimple.tsx",
    "src/components/FileOperationsPanel.tsx",
    "src/components/FileTree.tsx",
    "src/components/collaboration/SessionManager.tsx",
    "src/components/collaboration/CollaborationIntegration.tsx",
    "src/components/collaboration/CollaborativeEditor.tsx",
    "src/components/collaboration/CollaborativeFileTree.tsx",
    "src/components/collaboration/MultiSessionFileEditor.tsx",
    "src/components/collaboration/SavedSessions.tsx",
]

class CodeDocumentationGenerator:
    def __init__(self):
        self.doc = SimpleDocTemplate(
            str(DOCS_OUTPUT),
            pagesize=A4,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=0.75*inch
        )
        self.story = []
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self.visited_files = []
        
    def _setup_custom_styles(self):
        """Setup custom styles for the PDF"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Phase header style
        self.styles.add(ParagraphStyle(
            name='PhaseHeader',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=HexColor('#2563eb'),
            spaceAfter=20,
            spaceBefore=20,
            fontName='Helvetica-Bold'
        ))
        
        # File header style
        self.styles.add(ParagraphStyle(
            name='FileHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=HexColor('#059669'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))
        
        # Code style
        self.styles.add(ParagraphStyle(
            name='CodeBlock',
            parent=self.styles['Code'],
            fontSize=8,
            leftIndent=20,
            rightIndent=20,
            spaceAfter=10,
            fontName='Courier'
        ))
        
        # Info style
        self.styles.add(ParagraphStyle(
            name='Info',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=HexColor('#666666'),
            spaceAfter=8,
            fontName='Helvetica'
        ))
        
        # Explanation style
        self.styles.add(ParagraphStyle(
            name='Explanation',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=HexColor('#1e40af'),
            leftIndent=20,
            rightIndent=20,
            spaceAfter=10,
            spaceBefore=5,
            fontName='Helvetica-Oblique',
            borderColor=HexColor('#93c5fd'),
            borderWidth=1,
            borderPadding=8,
        ))
        
        # Function header style
        self.styles.add(ParagraphStyle(
            name='FunctionHeader',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=HexColor('#7c3aed'),
            spaceAfter=5,
            spaceBefore=10,
            fontName='Helvetica-Bold'
        ))

    def add_cover_page(self):
        """Add a cover page to the documentation"""
        self.story.append(Spacer(1, 2*inch))
        
        title = Paragraph("Backend Code Documentation", self.styles['CustomTitle'])
        self.story.append(title)
        self.story.append(Spacer(1, 0.3*inch))
        
        subtitle = Paragraph(
            "Complete Backend &amp; Logic Documentation (All 4 Phases)",
            self.styles['Heading2']
        )
        self.story.append(subtitle)
        self.story.append(Spacer(1, 0.5*inch))
        
        date_text = Paragraph(
            f"Generated on: {datetime.now().strftime('%B %d, %Y at %H:%M:%S')}",
            self.styles['Info']
        )
        self.story.append(date_text)
        
        self.story.append(PageBreak())

    def read_file_content(self, file_path):
        """Read file content with error handling"""
        full_path = PROJECT_ROOT / file_path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return content
        except Exception as e:
            return f"Error reading file: {str(e)}"

    def analyze_function(self, function_code):
        """Analyze a function and generate explanation"""
        lines = function_code.strip().split('\n')
        if not lines:
            return None
        
        first_line = lines[0].strip()
        explanations = []
        
        # Extract function name
        function_name = ""
        is_async = "async" in first_line
        
        # Different function patterns
        if "function" in first_line:
            match = re.search(r'function\s+(\w+)', first_line)
            if match:
                function_name = match.group(1)
        elif "const" in first_line and "=>" in function_code:
            match = re.search(r'const\s+(\w+)', first_line)
            if match:
                function_name = match.group(1)
        elif "export" in first_line:
            match = re.search(r'export\s+(?:const|function)\s+(\w+)', first_line)
            if match:
                function_name = match.group(1)
        
        if not function_name:
            return None
        
        # Build explanation
        explanation = f"<b>Function: {function_name}</b><br/>"
        
        if is_async:
            explanation += "• Asynchronous function (uses async/await)<br/>"
        
        # Analyze parameters
        param_match = re.search(r'\(([^)]*)\)', first_line)
        if param_match:
            params = param_match.group(1).strip()
            if params:
                param_list = [p.strip().split(':')[0].strip() for p in params.split(',')]
                explanation += f"• Parameters: {', '.join(param_list)}<br/>"
        
        # Analyze what the function does
        code_lower = function_code.lower()
        
        # Check for common patterns
        if 'usemutation' in code_lower or 'mutation(' in code_lower:
            explanation += "• Performs database mutations (create/update/delete operations)<br/>"
        
        if 'usequery' in code_lower or 'query(' in code_lower:
            explanation += "• Fetches data from the database<br/>"
        
        if 'useaction' in code_lower or 'action(' in code_lower:
            explanation += "• Executes backend actions<br/>"
        
        if 'fetch(' in code_lower or 'axios' in code_lower:
            explanation += "• Makes HTTP/API requests<br/>"
        
        if 'usestate' in code_lower:
            explanation += "• Manages component state<br/>"
        
        if 'useeffect' in code_lower:
            explanation += "• Handles side effects and lifecycle events<br/>"
        
        if 'useref' in code_lower:
            explanation += "• Uses refs for DOM access or mutable values<br/>"
        
        if 'setinterval' in code_lower or 'settimeout' in code_lower:
            explanation += "• Uses timers for delayed/repeated execution<br/>"
        
        if 'try' in code_lower and 'catch' in code_lower:
            explanation += "• Includes error handling<br/>"
        
        if 'return' in code_lower:
            # Check what it returns
            if 'return {' in code_lower or 'return(' in code_lower:
                explanation += "• Returns data/object/JSX<br/>"
        
        # Check for data transformations
        if '.map(' in function_code or '.filter(' in function_code or '.reduce(' in function_code:
            explanation += "• Transforms/processes data arrays<br/>"
        
        # Check for validation
        if 'validate' in code_lower or 'check' in code_lower or 'verify' in code_lower:
            explanation += "• Performs validation checks<br/>"
        
        # Check for event handling
        if 'onclick' in code_lower or 'onchange' in code_lower or 'onsubmit' in code_lower or 'handle' in function_name.lower():
            explanation += "• Handles user events/interactions<br/>"
        
        return explanation

    def extract_functions_and_explain(self, content):
        """Extract functions from code and generate explanations"""
        explanations = []
        
        # Pattern to match function declarations
        patterns = [
            r'(export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{',
            r'(export\s+)?const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
            r'(export\s+)?const\s+\w+\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*{',
        ]
        
        lines = content.split('\n')
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check if line starts a function
            is_function_start = False
            for pattern in patterns:
                if re.search(pattern, line):
                    is_function_start = True
                    break
            
            if is_function_start:
                # Collect function code
                function_lines = [line]
                brace_count = line.count('{') - line.count('}')
                i += 1
                
                while i < len(lines) and brace_count > 0:
                    function_lines.append(lines[i])
                    brace_count += lines[i].count('{') - lines[i].count('}')
                    i += 1
                    if brace_count == 0 or i >= len(lines):
                        break
                
                function_code = '\n'.join(function_lines)
                explanation = self.analyze_function(function_code)
                if explanation:
                    explanations.append({
                        'code': function_code[:500] + ('...' if len(function_code) > 500 else ''),
                        'explanation': explanation
                    })
            else:
                i += 1
        
        return explanations

    def analyze_code_structure(self, content, file_path):
        """Analyze overall code structure and purpose"""
        analysis = []
        
        # File type analysis
        if 'schema.ts' in file_path:
            analysis.append("📊 <b>Database Schema Definition</b> - Defines data models and table structures")
        elif 'store' in file_path.lower():
            analysis.append("🗄️ <b>State Management Store</b> - Manages application state using Zustand/Redux")
        elif 'hook' in file_path.lower():
            analysis.append("🎣 <b>Custom React Hook</b> - Reusable logic for React components")
        elif 'middleware' in file_path.lower():
            analysis.append("🔒 <b>Middleware</b> - Intercepts requests for authentication/logging")
        elif 'route.ts' in file_path:
            analysis.append("🛣️ <b>API Route Handler</b> - Handles HTTP requests and responses")
        elif 'utils' in file_path.lower() or 'helper' in file_path.lower():
            analysis.append("🔧 <b>Utility Functions</b> - Helper functions and common utilities")
        elif any(x in file_path for x in ['collaboration', 'session', 'file', 'folder']):
            analysis.append("⚙️ <b>Business Logic</b> - Core application functionality")
        
        # Count different code elements
        imports = len(re.findall(r'^import ', content, re.MULTILINE))
        exports = len(re.findall(r'^export ', content, re.MULTILINE))
        functions = len(re.findall(r'function\s+\w+|const\s+\w+\s*=\s*.*=>', content))
        
        analysis.append(f"📦 Contains: {imports} imports, {exports} exports, ~{functions} functions/constants")
        
        # Check for specific technologies
        if 'convex' in content:
            analysis.append("🔷 Uses Convex backend framework")
        if 'clerk' in content.lower():
            analysis.append("🔐 Integrates Clerk authentication")
        if 'zustand' in content.lower():
            analysis.append("📊 Uses Zustand for state management")
        if 'monaco' in content.lower():
            analysis.append("📝 Integrates Monaco code editor")
        
        return '<br/>'.join(analysis)

    def add_visited_comment(self, file_path, phase_number):
        """Add a comment to the file indicating it has been documented"""
        full_path = PROJECT_ROOT / file_path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if already documented
            comment_marker = f"DOCUMENTED BY SCRIPT - Phase {phase_number}"
            if comment_marker in content:
                return
            
            # Determine comment syntax based on file extension
            ext = full_path.suffix
            if ext in ['.ts', '.tsx', '.js', '.jsx']:
                comment = f"// {comment_marker}\n"
            elif ext in ['.json']:
                # JSON files cannot have comments, skip
                return
            else:
                comment = f"# {comment_marker}\n"
            
            # Add comment at the beginning
            new_content = comment + content
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"✓ Added documentation comment to: {file_path}")
        except Exception as e:
            print(f"✗ Error adding comment to {file_path}: {str(e)}")

    def extract_logic_from_code(self, content, file_extension, phase_number):
        """
        Extract only logic/backend code, excluding JSX/TSX rendering
        For Phase 1-3, we include everything as these are pure backend/config files
        For Phase 4, we extract only business logic from frontend files
        """
        # Phase 1-3 files are pure backend/config, so return full content
        if phase_number in [1, 2, 3]:
            return content
        
        # Phase 4: Extract only logic from frontend files
        if file_extension not in ['.tsx', '.jsx', '.ts', '.js']:
            return content
        
        # For .ts files (non-TSX), return full content as they typically don't have JSX
        if file_extension == '.ts':
            return content
        
        # For TSX/JSX files, extract logic only
        lines = content.split('\n')
        logic_lines = []
        inside_return = False
        inside_jsx = False
        brace_count = 0
        paren_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Track return statements
            if 'return (' in line or 'return(' in line:
                inside_return = True
                paren_count = line.count('(') - line.count(')')
                # Add a marker instead of the JSX
                logic_lines.append(f"{' ' * (len(line) - len(line.lstrip()))}// [JSX RENDERING CODE EXCLUDED]")
                i += 1
                continue
            
            if inside_return:
                paren_count += line.count('(') - line.count(')')
                if paren_count <= 0:
                    inside_return = False
                i += 1
                continue
            
            # Skip pure JSX blocks (lines with lots of HTML-like tags)
            if stripped.startswith('<') and '>' in stripped and not stripped.startswith('</'):
                # Check if it's a JSX element
                if any(tag in stripped for tag in ['<div', '<button', '<input', '<span', '<p', '<h1', '<h2', '<h3', '<section', '<main', '<header', '<footer']):
                    inside_jsx = True
                    brace_count = 0
            
            if inside_jsx:
                brace_count += line.count('{') - line.count('}')
                if stripped.endswith('>') or stripped.endswith('/>') or stripped.endswith('};'):
                    if brace_count <= 0:
                        inside_jsx = False
                i += 1
                continue
            
            # Include these types of lines (business logic)
            should_include = any([
                # Imports
                stripped.startswith('import '),
                stripped.startswith('export '),
                # Type definitions
                stripped.startswith('type '),
                stripped.startswith('interface '),
                # Constants and variables with logic
                stripped.startswith('const ') and '=' in stripped and not 'className' in stripped,
                stripped.startswith('let '),
                stripped.startswith('var '),
                # Functions
                stripped.startswith('function '),
                stripped.startswith('async function'),
                # Hooks with logic (but not just destructuring)
                'useState' in stripped and ('?' in stripped or 'if' in stripped or '||' in stripped),
                'useEffect' in stripped,
                'useMutation' in stripped,
                'useQuery' in stripped,
                'useAction' in stripped,
                'useCallback' in stripped,
                'useMemo' in stripped,
                'useRef' in stripped and ('?' in stripped or 'if' in stripped),
                # Zustand store
                'create(' in stripped or 'useStore' in stripped,
                # Logic statements
                stripped.startswith('if ') or stripped.startswith('if('),
                stripped.startswith('else'),
                stripped.startswith('for ') or stripped.startswith('for('),
                stripped.startswith('while '),
                stripped.startswith('switch '),
                stripped.startswith('case '),
                stripped.startswith('try'),
                stripped.startswith('catch'),
                stripped.startswith('throw'),
                # API calls and data operations
                'fetch(' in stripped,
                'axios' in stripped,
                '.map(' in stripped and not 'children' in stripped,
                '.filter(' in stripped,
                '.reduce(' in stripped,
                '.find(' in stripped,
                # Event handlers (but not JSX attributes)
                'const handle' in stripped.lower() or 'const on' in stripped.lower(),
                'function handle' in stripped.lower(),
                # Comments (keep them for context)
                stripped.startswith('//'),
                stripped.startswith('/*'),
                stripped.startswith('*'),
                stripped.endswith('*/'),
                # Component definition start
                'export default function' in stripped,
                'export function' in stripped,
                'export const' in stripped and '=>' in stripped,
                # Closing braces (to maintain structure)
                stripped == '}' or stripped == '};' or stripped == '},',
            ])
            
            # Exclude these patterns (pure UI code)
            should_exclude = any([
                'className=' in stripped,
                'style=' in stripped and '{' in stripped,
                '<motion.' in stripped,
                'variants=' in stripped,
                'initial=' in stripped,
                'animate=' in stripped,
                'whileHover=' in stripped,
                stripped.startswith('<div') and 'onClick' not in stripped and 'onChange' not in stripped,
            ])
            
            if should_include and not should_exclude:
                logic_lines.append(line)
            
            i += 1
        
        extracted = '\n'.join(logic_lines)
        
        # If we extracted very little, return a message
        if len(extracted.strip()) < 100:
            return "// Minimal business logic found - mostly presentational component"
        
        return extracted

    def add_file_documentation(self, file_path, phase_number):
        """Add documentation for a single file"""
        print(f"Processing: {file_path}")
        
        # File header
        file_header = Paragraph(
            f"📄 File: {file_path}",
            self.styles['FileHeader']
        )
        self.story.append(file_header)
        
        # File info
        full_path = PROJECT_ROOT / file_path
        if full_path.exists():
            file_size = full_path.stat().st_size
            modified_time = datetime.fromtimestamp(full_path.stat().st_mtime)
            
            info = Paragraph(
                f"Size: {file_size} bytes | Last Modified: {modified_time.strftime('%Y-%m-%d %H:%M:%S')}",
                self.styles['Info']
            )
            self.story.append(info)
            self.story.append(Spacer(1, 0.1*inch))
        
        # Read file content
        content = self.read_file_content(file_path)
        
        # Add code structure analysis
        structure_analysis = self.analyze_code_structure(content, file_path)
        if structure_analysis:
            analysis_para = Paragraph(
                f"<b>📋 File Overview:</b><br/>{structure_analysis}",
                self.styles['Explanation']
            )
            self.story.append(analysis_para)
            self.story.append(Spacer(1, 0.15*inch))
        
        # Extract logic (for Phase 1-3, returns full content; Phase 4 extracts logic only)
        logic_content = self.extract_logic_from_code(content, full_path.suffix, phase_number)
        
        # Extract and explain functions
        function_explanations = self.extract_functions_and_explain(logic_content)
        
        if function_explanations:
            func_header = Paragraph(
                "🔍 <b>Functions & Logic Analysis:</b>",
                self.styles['FunctionHeader']
            )
            self.story.append(func_header)
            self.story.append(Spacer(1, 0.1*inch))
            
            for func_info in function_explanations[:10]:  # Limit to first 10 functions
                # Add explanation
                explanation_para = Paragraph(
                    func_info['explanation'],
                    self.styles['Explanation']
                )
                self.story.append(explanation_para)
                
                # Add code snippet
                code_snippet = Preformatted(
                    func_info['code'][:800],  # Limit code length
                    self.styles['CodeBlock']
                )
                self.story.append(code_snippet)
                self.story.append(Spacer(1, 0.1*inch))
        
        # Add full code block (truncated if too long)
        if logic_content and logic_content.strip():
            code_header = Paragraph(
                "📝 <b>Complete Code:</b>",
                self.styles['FunctionHeader']
            )
            self.story.append(code_header)
            self.story.append(Spacer(1, 0.05*inch))
            
            # Truncate if necessary
            max_length = 8000
            truncated_code = logic_content[:max_length]
            if len(logic_content) > max_length:
                truncated_code += f"\n\n... (truncated {len(logic_content) - max_length} characters)"
            
            code_block = Preformatted(
                truncated_code,
                self.styles['CodeBlock']
            )
            self.story.append(code_block)
        else:
            no_logic = Paragraph(
                "<i>No backend logic found in this file.</i>",
                self.styles['Info']
            )
            self.story.append(no_logic)
        
        self.story.append(Spacer(1, 0.3*inch))
        
        # Add visited comment to the actual file
        self.add_visited_comment(file_path, phase_number)
        self.visited_files.append(file_path)

    def generate_phase_1(self):
        """Generate Phase 1 documentation"""
        print("\n" + "="*60)
        print("PHASE 1: Core Backend Schema, Models & Configuration")
        print("="*60 + "\n")
        
        # Add phase header
        phase_header = Paragraph(
            "Phase 1: Core Backend Schema, Models & Configuration",
            self.styles['PhaseHeader']
        )
        self.story.append(phase_header)
        
        description = Paragraph(
            "This phase documents the core database schema, type definitions, "
            "and configuration files that form the foundation of the backend system.",
            self.styles['Normal']
        )
        self.story.append(description)
        self.story.append(Spacer(1, 0.3*inch))
        
        # Process each file
        for file_path in PHASE_1_FILES:
            full_path = PROJECT_ROOT / file_path
            if full_path.exists():
                self.add_file_documentation(file_path, 1)
            else:
                print(f"⚠ File not found: {file_path}")
                self.story.append(Paragraph(
                    f"<b>File not found:</b> {file_path}",
                    self.styles['Info']
                ))
                self.story.append(Spacer(1, 0.2*inch))

    def generate_phase_2(self):
        """Generate Phase 2 documentation"""
        print("\n" + "="*60)
        print("PHASE 2: Backend Business Logic & Core Operations")
        print("="*60 + "\n")
        
        # Add phase header
        self.story.append(PageBreak())
        phase_header = Paragraph(
            "Phase 2: Backend Business Logic & Core Operations",
            self.styles['PhaseHeader']
        )
        self.story.append(phase_header)
        
        description = Paragraph(
            "This phase documents all backend business logic including mutations, queries, "
            "action functions, code execution, collaboration features, file/folder operations, "
            "user management, payment integration, and scheduled jobs.",
            self.styles['Normal']
        )
        self.story.append(description)
        self.story.append(Spacer(1, 0.3*inch))
        
        # Process each file
        for file_path in PHASE_2_FILES:
            full_path = PROJECT_ROOT / file_path
            if full_path.exists():
                self.add_file_documentation(file_path, 2)
            else:
                print(f"⚠ File not found: {file_path}")
                self.story.append(Paragraph(
                    f"<b>File not found:</b> {file_path}",
                    self.styles['Info']
                ))
                self.story.append(Spacer(1, 0.2*inch))

    def generate_phase_3(self):
        """Generate Phase 3 documentation"""
        print("\n" + "="*60)
        print("PHASE 3: Server-Side Logic, Middleware & API Routes")
        print("="*60 + "\n")
        
        # Add phase header
        self.story.append(PageBreak())
        phase_header = Paragraph(
            "Phase 3: Server-Side Logic, Middleware & API Routes",
            self.styles['PhaseHeader']
        )
        self.story.append(phase_header)
        
        description = Paragraph(
            "This phase documents server-side middleware, authentication checks, "
            "request/response handling, and API route implementations.",
            self.styles['Normal']
        )
        self.story.append(description)
        self.story.append(Spacer(1, 0.3*inch))
        
        # Process each file
        for file_path in PHASE_3_FILES:
            full_path = PROJECT_ROOT / file_path
            if full_path.exists():
                self.add_file_documentation(file_path, 3)
            else:
                print(f"⚠ File not found: {file_path}")
                self.story.append(Paragraph(
                    f"<b>File not found:</b> {file_path}",
                    self.styles['Info']
                ))
                self.story.append(Spacer(1, 0.2*inch))

    def generate_phase_4(self):
        """Generate Phase 4 documentation"""
        print("\n" + "="*60)
        print("PHASE 4: Application Logic from Frontend Files")
        print("="*60 + "\n")
        
        # Add phase header
        self.story.append(PageBreak())
        phase_header = Paragraph(
            "Phase 4: Application Logic from Frontend Files",
            self.styles['PhaseHeader']
        )
        self.story.append(phase_header)
        
        description = Paragraph(
            "This phase extracts business logic, state management, event handlers, "
            "data processing functions, and utility code from frontend component files. "
            "JSX rendering code and pure UI elements are excluded.",
            self.styles['Normal']
        )
        self.story.append(description)
        self.story.append(Spacer(1, 0.3*inch))
        
        # Process each file
        for file_path in PHASE_4_FILES:
            full_path = PROJECT_ROOT / file_path
            if full_path.exists():
                self.add_file_documentation(file_path, 4)
            else:
                print(f"⚠ File not found: {file_path}")
                self.story.append(Paragraph(
                    f"<b>File not found:</b> {file_path}",
                    self.styles['Info']
                ))
                self.story.append(Spacer(1, 0.2*inch))

    def add_summary_page(self):
        """Add a summary page at the end"""
        self.story.append(PageBreak())
        
        summary_header = Paragraph(
            "Documentation Summary",
            self.styles['PhaseHeader']
        )
        self.story.append(summary_header)
        
        summary_text = Paragraph(
            f"<b>All Phases Completed:</b> Phase 1, 2, 3 &amp; 4<br/>"
            f"<b>Total Files Documented:</b> {len(self.visited_files)}<br/>"
            f"<b>Files Processed:</b><br/>",
            self.styles['Normal']
        )
        self.story.append(summary_text)
        
        for file_path in self.visited_files:
            file_item = Paragraph(f"• {file_path}", self.styles['Normal'])
            self.story.append(file_item)

    def generate(self):
        """Generate the complete documentation"""
        print("\n🚀 Starting Code Documentation Generation...")
        print(f"📁 Project Root: {PROJECT_ROOT}")
        print(f"📄 Output File: {DOCS_OUTPUT}\n")
        
        # Add cover page
        self.add_cover_page()
        
        # Generate Phase 1
        self.generate_phase_1()
        
        # Generate Phase 2
        self.generate_phase_2()
        
        # Generate Phase 3
        self.generate_phase_3()
        
        # Generate Phase 4
        self.generate_phase_4()
        
        # Add summary
        self.add_summary_page()
        
        # Build PDF
        print("\n📝 Building PDF document...")
        try:
            self.doc.build(self.story)
            print(f"\n✅ Documentation generated successfully!")
            print(f"📄 Output: {DOCS_OUTPUT}")
            print(f"✓ {len(self.visited_files)} files documented\n")
        except Exception as e:
            print(f"\n❌ Error generating PDF: {str(e)}")
            raise

def main():
    """Main entry point"""
    try:
        generator = CodeDocumentationGenerator()
        generator.generate()
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        raise

if __name__ == "__main__":
    main()
