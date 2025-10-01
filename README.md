# CodeCraft - Collaborative Code Editor Platform

## 🚀 Project Overview

**CodeCraft** is a modern, full-stack collaborative coding platform built with Next.js, TypeScript, and Convex. It provides real-time collaborative editing, comprehensive file management, and multi-language code execution in a VSCode-inspired interface.

### 🎯 Current Status: **ALL PHASES COMPLETED ✅**
- ✅ **Phase 1**: Core Editor & Code Execution
- ✅ **Phase 2**: Advanced File Operations & Search  
- ✅ **Phase 3**: Real-time Collaboration Features

---

## 🏗️ Architecture Overview

### Frontend Architecture
```
src/
├── app/                          # Next.js App Router
│   ├── (root)/                  # Main editor interface
│   ├── collaboration/           # Real-time collaboration hub
│   ├── files/                   # File management interface
│   ├── snippets/               # Code snippet sharing
│   ├── profile/                # User profile & analytics
│   └── pricing/                # Subscription management
├── components/                  # Reusable UI components
│   ├── collaboration/          # Collaboration-specific components
│   ├── providers/              # Context providers
│   └── [various UI components]
├── hooks/                      # Custom React hooks
├── store/                      # Zustand state management
└── types/                      # TypeScript type definitions
```

### Backend Architecture (Convex)
```
convex/
├── schema.ts                   # Database schema definition
├── collaboration.ts           # Real-time collaboration logic
├── files.ts                   # File operations
├── folders.ts                 # Folder management
├── snippets.ts                # Code snippet management
├── users.ts                   # User management
├── codeExecution.ts           # Code execution tracking
├── lemonSqueezy.ts            # Payment processing
└── http.ts                    # HTTP webhooks
```

---

## 📋 Core Features

### 🎨 **1. Multi-Language Code Editor** 
**Location**: `src/app/(root)/_components/`

#### Key Components:
- **EditorPanel.tsx**: Main Monaco editor interface
- **LanguageSelector.tsx**: Programming language selection
- **ThemeSelector.tsx**: Editor theme management
- **RunButton.tsx**: Code execution trigger

#### API Flow:
```typescript
// Code execution flow
1. User writes code in Monaco Editor
2. RunButton.tsx → useCodeEditorStore.runCode()
3. Store calls Piston API for execution
4. Results displayed in OutputPanel.tsx
5. Execution saved via api.codeExecution.saveExecution

// Pseudo-code
const handleRun = async () => {
  await runCode(); // Execute via Piston API
  const result = getExecutionResult();
  if (user && result) {
    await saveExecution({
      language, code, output, error
    });
  }
};
```

#### Supported Languages:
- JavaScript/TypeScript, Python, Java, C++, Go, Rust, Swift

---

### 📁 **2. Advanced File Management System**
**Location**: `src/components/` & `src/app/files/`

#### Key Components:
- **FileTree.tsx**: Hierarchical file browser
- **MultiFileEditor.tsx**: Tabbed editor interface  
- **FileOperationsPanel.tsx**: Bulk file operations
- **SearchResults.tsx**: Global file search

#### Database Schema:
```typescript
// practiceFiles table
{
  userId: string,
  folderId?: Id<"folders">,
  name: string,
  language: string,
  code: string,
  description?: string,
  isShared: boolean,
  path: string,
  createdAt: number,
  updatedAt: number
}
```

#### API Operations:
```typescript
// File CRUD operations in convex/files.ts

// Create file
api.files.createFile({
  name, language, code, folderId?, description?
})

// Update file content  
api.files.updateFile({
  fileId, code?, description?, userId
})

// Search files
api.files.searchFiles({
  userId, searchTerm
})

// Bulk operations
api.files.batchDeleteFiles({
  userId, fileIds: Id<"practiceFiles">[]
})
```

#### Advanced Features:
- **Auto-save**: 2-second interval saving
- **Keyboard Shortcuts**: Ctrl+Shift+P (search), Ctrl+Shift+O (operations)
- **Bulk Operations**: Move, delete, export multiple files
- **Smart Search**: Content, name, and description search

---

### 🤝 **3. Real-time Collaboration System**
**Location**: `src/components/collaboration/` & `src/app/collaboration/`

#### Core Components:

##### **SessionManager.tsx**: Session Discovery & Management
```typescript
// Session creation flow
const handleCreateSession = async (formData: FormData) => {
  const sessionId = await createSession({
    name, creatorId: user.id, language,
    code, isPublic, maxUsers
  });
  onSessionSelect(sessionId);
};

// Join session flow  
const handleJoinSession = async (sessionId) => {
  await joinSession({ sessionId, userId: user.id });
  onSessionSelect(sessionId);
};
```

##### **CollaborativeEditor.tsx**: Real-time Editing Interface
```typescript
// Real-time code synchronization
const handleCodeChange = useCallback((value: string) => {
  setCode(value);
  
  // Debounced update to prevent conflicts
  clearTimeout(updateTimeoutRef.current);
  updateTimeoutRef.current = setTimeout(async () => {
    await updateSessionCode({
      sessionId, userId: user.id, code: value
    });
  }, 300); // 300ms debounce for responsiveness
}, [sessionId, user?.id]);

// Handle remote updates without conflicts
useEffect(() => {
  if (session?.code && 
      session.code !== lastRemoteCode.current && 
      !isUpdatingFromRemote.current) {
    
    const editor = editorRef.current;
    if (editor) {
      const position = editor.getPosition();
      isUpdatingFromRemote.current = true;
      setCode(session.code);
      
      // Restore cursor position
      setTimeout(() => {
        editor.setPosition(position);
        isUpdatingFromRemote.current = false;
      }, 50);
    }
  }
}, [session?.code]);
```

#### Database Schema:
```typescript
// Collaboration tables
collaborativeSessions: {
  name: string,
  creatorId: string,
  language: string, 
  code: string,
  isPublic: boolean,
  isActive: boolean,
  activeUsers: string[],
  maxUsers: number,
  createdAt: number,
  lastActivity: number
}

sessionParticipants: {
  sessionId: Id<"collaborativeSessions">,
  userId: string,
  userName: string,
  permission: "read" | "write",
  joinedAt: number,
  lastActive: number,
  isActive: boolean
}

sessionMessages: {
  sessionId: Id<"collaborativeSessions">,
  userId: string,
  userName: string,
  message: string,
  timestamp: number
}
```

#### Collaboration Features:
- **Real-time Code Sync**: 300ms debounced updates
- **User Presence**: Live participant tracking
- **Permission System**: Read/write access control
- **Integrated Chat**: Real-time messaging
- **Session Management**: Create/join/leave sessions
- **Conflict Resolution**: Smart update handling

---

### 📊 **4. Code Snippet Sharing Platform**
**Location**: `src/app/snippets/` & `convex/snippets.ts`

#### Components:
- **SnippetCard.tsx**: Individual snippet display
- **Comments.tsx**: Snippet commenting system
- **StarButton.tsx**: Snippet starring/favorites

#### API Flow:
```typescript
// Snippet management
api.snippets.createSnippet({
  title, language, code, userId, userName
})

api.snippets.deleteSnippet({ snippetId })

// Social features
api.snippets.toggleStar({ snippetId })
api.snippets.createComment({ 
  snippetId, content, userId, userName 
})
```

---

### 💳 **5. Subscription & Payment System**  
**Location**: `src/app/pricing/` & `convex/lemonSqueezy.ts`

#### Payment Flow:
```typescript
// Pro upgrade process
1. User clicks upgrade on pricing page
2. LemonSqueezy checkout initiated  
3. Webhook processes payment completion
4. User record updated via api.users.upgradeToPro()
5. Pro features unlocked (multi-language support)

// Webhook handler in convex/http.ts
if (payload.meta.event_name === "order_created") {
  await ctx.runMutation(api.users.upgradeToPro, {
    email: data.attributes.user_email,
    lemonSqueezyCustomerId: customerId,
    lemonSqueezyOrderId: orderId,
  });
}
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI Library**: Tailwind CSS + Custom Components
- **Editor**: Monaco Editor (VSCode engine)
- **State Management**: Zustand
- **Animation**: Framer Motion
- **Authentication**: Clerk

### Backend  
- **Database**: Convex (Real-time)
- **API**: Convex Functions (Query/Mutation)
- **Code Execution**: Piston API
- **Payments**: LemonSqueezy
- **Real-time**: WebSocket via Convex

### Development Tools
- **Package Manager**: npm
- **Bundler**: Next.js/Turbopack  
- **Linting**: ESLint
- **Type Checking**: TypeScript

---

## 🚀 Getting Started

### Prerequisites
```bash
Node.js 18+ 
npm or yarn
Convex CLI
```

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Major
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
```

4. **Initialize Convex**
```bash
npx convex dev
```

5. **Run development server**
```bash
npm run dev
```

6. **Access the application**
```
http://localhost:3000
```

---

## 📁 Key File Locations & Purposes

### Core Application Files
```
src/app/(root)/page.tsx              # Main editor page
src/app/collaboration/page.tsx       # Collaboration hub  
src/app/files/page.tsx              # File management
src/store/useCodeEditorStore.ts     # Global editor state
```

### Backend Functions
```
convex/collaboration.ts             # Session management, real-time sync
convex/files.ts                     # File CRUD operations
convex/schema.ts                    # Database schema definition
convex/http.ts                      # Webhook handlers
```

### Component Architecture
```
src/components/collaboration/       # Collaboration components
  ├── SessionManager.tsx           # Session discovery/creation
  ├── CollaborativeEditor.tsx      # Real-time editor
  └── CollaborationIntegration.tsx # Quick collaboration access

src/components/                     # Core UI components
  ├── FileTree.tsx                 # File browser
  ├── MultiFileEditor.tsx          # Tabbed editor
  └── SearchResults.tsx            # Global search
```

---

## 🎯 API Reference

### Authentication
All API calls require Clerk authentication. User identity is automatically injected into Convex functions.

### Core API Endpoints

#### **File Operations**
```typescript
// Create file
api.files.createFile({
  name: string,
  language: string, 
  code: string,
  folderId?: Id<"folders">,
  description?: string
})

// Update file
api.files.updateFile({
  fileId: Id<"practiceFiles">,
  code?: string,
  description?: string, 
  userId: string
})

// Search files
api.files.searchFiles({
  userId: string,
  searchTerm: string
})
```

#### **Collaboration**
```typescript
// Create session
api.collaboration.createSession({
  name: string,
  creatorId: string,
  language: string,
  code?: string,
  isPublic: boolean,
  maxUsers?: number
})

// Join session  
api.collaboration.joinSession({
  sessionId: Id<"collaborativeSessions">,
  userId: string
})

// Update code
api.collaboration.updateSessionCode({
  sessionId: Id<"collaborativeSessions">,
  userId: string,
  code: string
})
```

#### **User Management**
```typescript
// Get user profile
api.users.getUser({ userId: string })

// Upgrade to Pro
api.users.upgradeToPro({
  email: string,
  lemonSqueezyCustomerId: string,
  lemonSqueezyOrderId: string
})
```

---

## 🧪 Code Execution Flow

### Piston API Integration
```typescript
// Located in: src/store/useCodeEditorStore.ts

const runCode = async () => {
  setIsRunning(true);
  
  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ content: code }],
      }),
    });
    
    const data = await response.json();
    
    if (data.run) {
      setOutput(data.run.stdout || "");
      setError(data.run.stderr || "");
    }
  } catch (error) {
    setError("Execution failed");
  } finally {
    setIsRunning(false);
  }
};
```

---

## 🔄 Real-time Data Flow

### Convex Real-time Subscriptions
```typescript
// Component automatically re-renders when data changes

// File updates
const files = useQuery(api.files.getUserFiles, { userId });

// Collaboration session
const session = useQuery(api.collaboration.getSession, { sessionId });

// Chat messages  
const messages = useQuery(api.collaboration.getChatMessages, { 
  sessionId, limit: 50 
});
```

### Optimistic Updates
```typescript
// Files auto-save with optimistic UI updates
useEffect(() => {
  const interval = setInterval(async () => {
    if (activeTabId && unsavedChanges.has(activeTabId)) {
      const code = unsavedChanges.get(activeTabId);
      await updateFile({ fileId: activeTabId, code, userId });
      
      // Update UI optimistically
      setTabs(tabs => tabs.map(tab => 
        tab.fileId === activeTabId ? { ...tab, isDirty: false } : tab
      ));
    }
  }, 2000);
}, [activeTabId, unsavedChanges]);
```

---

## 🎨 UI/UX Design Patterns

### Theme System
- **Dark Theme**: VSCode-inspired color scheme
- **Responsive Design**: Mobile-first approach
- **Accessibility**: ARIA labels, keyboard navigation
- **Performance**: Optimized Monaco Editor settings

### Component Structure
```typescript
// Typical component pattern
interface ComponentProps {
  // Strongly typed props
}

export default function Component({ prop }: ComponentProps) {
  // Convex hooks for data
  const data = useQuery(api.module.function, args);
  const mutation = useMutation(api.module.mutationFunction);
  
  // Local state
  const [state, setState] = useState();
  
  // Event handlers
  const handleAction = async () => {
    await mutation({ ...args });
  };
  
  return (
    // JSX with Tailwind classes
  );
}
```

---

## 🔧 Development Guidelines

### Code Organization
- **Colocation**: Keep related files together
- **TypeScript**: Strict type checking enabled
- **Component Composition**: Prefer composition over inheritance  
- **Custom Hooks**: Extract reusable logic

### Performance Optimizations
- **Debounced Updates**: Prevent excessive API calls
- **Optimistic UI**: Immediate feedback before server confirmation
- **Code Splitting**: Lazy-loaded routes and components
- **Monaco Optimization**: Disabled heavy features for collaboration

### Error Handling
```typescript
// Standard error handling pattern
try {
  await mutation({ ...args });
  // Success feedback
} catch (error) {
  console.error('Operation failed:', error);
  // User-friendly error message
}
```

---

## 🚀 Deployment

### Production Setup
1. **Deploy to Vercel**: `npm run build && vercel`
2. **Convex Production**: `npx convex deploy`  
3. **Environment Variables**: Set in Vercel dashboard
4. **Domain Configuration**: Update CORS settings

### Performance Monitoring
- **Error Tracking**: Convex function logs
- **User Analytics**: Clerk dashboard
- **Performance**: Vercel analytics

---

## 🎯 Future Enhancements

Based on the current architecture, potential additions include:
- Git integration and version control
- Advanced AI code completion
- Docker container deployment
- Mobile app (React Native)
- Advanced admin dashboard
- Team management features

---

## 📄 License

This project is part of a Major Project for educational purposes.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)  
5. Open Pull Request

---

**Built with ❤️ using Next.js, TypeScript, and Convex**
