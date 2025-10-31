# Opencode Orchestrator

## Overview

A distributed system for orchestrating local workers through a web interface, enabling users to delegate tasks to machines running the Opencode worker.

### System Components

1. **Next.JS Webapp** - Web interface for users to orchestrate workers via chat
2. **Convex Backend** - Realtime backend that captures messages in a stateful way and facilitates communication between workers and frontend
3. **Opencode Worker** - Local application that subscribes to a Convex collection and processes delegated tasks

## Core Flows

### Flow 1: Ad-hoc Message Processing

Users can send messages in real-time that are processed immediately by the Opencode worker.

```plantuml
@startuml
actor User
participant "Next.JS\nWebapp" as Frontend
participant "Convex\nBackend" as Backend
participant "Opencode\nWorker" as Worker

User -> Frontend: Send message via chat
Frontend -> Backend: Write message to collection
Backend --> Worker: Real-time subscription update
Worker -> Worker: Process message
Worker -> Backend: Write response/status
Backend --> Frontend: Real-time update
Frontend -> User: Display response
@enduml
```

### Flow 2: Scheduled Job Processing

Users can configure cron jobs that are handled by Convex, which writes to a table at specified times for worker processing.

```plantuml
@startuml
actor User
participant "Next.JS\nWebapp" as Frontend
participant "Convex\nBackend" as Backend
participant "Convex\nCron" as Cron
participant "Opencode\nWorker" as Worker

User -> Frontend: Configure cron job
Frontend -> Backend: Store cron configuration
Backend -> Cron: Schedule job

... Time passes ...

Cron -> Backend: Trigger at scheduled time
Backend -> Backend: Write to table
Backend --> Worker: Real-time subscription update
Worker -> Worker: Process command
Worker -> Backend: Write response/status
Backend --> Frontend: Real-time update (if user online)
@enduml
```

### Flow 3: Worker Registration and Usage

Complete flow from machine registration to executing worker tasks.

```plantuml
@startuml
actor User
participant "Next.JS\nWebapp" as Frontend
participant "Convex\nBackend" as Backend
participant "Machine\nProcess" as Machine
participant "Opencode\nWorker" as Worker

== Machine Registration ==
User -> Frontend: Add machine (provide name)
Frontend -> Backend: Create machine registration
Backend -> Frontend: Return registration key
Frontend -> User: Display registration key

User -> Machine: Clone repo & run start
Machine -> Machine: Check for MACHINE_ID
Machine -> User: Prompt for registration key
User -> Machine: Provide registration key
User -> Machine: Provide root directory
Machine -> Backend: Register with key
Backend -> Machine: Return MACHINE_ID & secret
Machine -> Machine: Store MACHINE_ID & secret
Backend --> Frontend: Update machine status (online)
Frontend -> User: Show machine online

== Directory Operations ==
User -> Frontend: Browse directory
Frontend -> Backend: Request directory listing
Backend -> Machine: Query directory structure
Machine -> Backend: Return directory tree
Backend -> Frontend: Display directory tree

User -> Frontend: Create folder "repos"
Frontend -> Backend: Create folder command
Backend -> Machine: Execute mkdir
Machine -> Backend: Confirm creation

User -> Frontend: Execute git clone command
Frontend -> Backend: Send git clone command
Backend -> Machine: Execute git clone
Machine -> Backend: Update progress/completion

== Worker Setup ==
User -> Frontend: Select folder & "Add Worker"
Frontend -> Backend: worker.register(machineId)
Backend -> Backend: Create worker record
Backend --> Frontend: Update machine (1 worker)
Frontend -> User: Show worker registered

== Chat Session ==
User -> Frontend: Select worker & start chat
Frontend -> Backend: worker.chat.startSession(machineId, workerId)
Backend -> Machine: Start session request
Machine -> Worker: Start new opencode process
Worker -> Worker: Initialize client
Worker -> Machine: Client ready
Machine -> Backend: Session started
Backend -> Frontend: Session ready

== Message Processing ==
User -> Frontend: Send message
Frontend -> Backend: worker.chat.sendMessage(chatSessionId, message)
Backend --> Machine: Message notification
Machine -> Machine: Route to worker by session ID
Machine -> Worker: Pass message to opencode session
Worker -> Worker: Process with opencode

loop Streaming Response
    Worker -> Backend: worker.chat.writeChunk(chunk)
    Backend --> Frontend: Stream chunk
    Frontend -> User: Display chunk in realtime
end

Worker -> Backend: worker.chat.writeMessage(fullMessage)
Backend --> Frontend: Complete message available
@enduml
```

#### Key Components

**Machine Registration**

- Registration key-based authentication
- Persistent storage of MACHINE_ID and secret
- Root directory configuration for sandboxed operations

**Worker Management**

- Workers are associated with specific directories on machines
- `worker.register(machineId)` creates worker instance
- Multiple workers can exist per machine

**Chat Interface**

- `worker.chat.startSession(machineId, workerId)` - Initializes opencode process
- `worker.chat.sendMessage(chatSessionId, message)` - Sends user message
- `worker.chat.writeChunk(chunk)` - Streams response chunks
- `worker.chat.writeMessage(fullMessage)` - Sends complete message

**Dual Channel Response**

- Chunk channel: Real-time streaming updates
- Message channel: Complete message delivery
- Frontend subscribes to chunks for live updates

## Design Decisions

### Authentication & Security

**Machine Token**

- Format: `<machine_id>:<machine_secret>`
- Generated automatically when user creates a machine from the UI
- Token is one-time use during registration
- Machine authenticates to Convex using the combined token
- Both ID and secret are generated client-side using nanoid

### Worker Identity & Concurrency

**Directory-Bound Workers**

- Workers are bound to specific directories on the machine
- Worker identity persists across machine restarts
- Multiple concurrent chat sessions are supported per worker
- Each chat session spawns its own opencode process and session
- Enables parallel task execution within the same worker context

**Session Lifecycle & Timeouts**

- Default session idle timeout: 5 minutes
- If opencode process is terminated and user sends a message:
  1. Worker starts new opencode process
  2. Runs `client.sessions` command
  3. Resumes session using session ID from Convex
- All chat messages include session ID for routing and recovery

### State Management & Recovery

**Stateless Machine Process**

- All worker registrations are stored in Convex
- Machine state is fully recoverable using only the machine token
- Machine process can die and restart without data loss
- On restart, machine queries Convex to restore:
  - List of registered workers
  - Active chat sessions
  - Pending tasks

**Implications**

- Convex is the source of truth for all orchestration state
- Machines are stateless execution environments
- Graceful recovery from machine crashes
- Simplified machine deployment (no local state to backup)

### ID Allocation Strategy

**Client-Generated IDs**

The system uses nanoid for all primary identifiers to maintain control over ID generation and avoid dependency on Convex's auto-generated IDs.

| Entity       | ID Source    | Generated By      | Notes                                  |
| ------------ | ------------ | ----------------- | -------------------------------------- |
| Machine      | `machine_id` | Frontend (webapp) | Part of machine token                  |
| Worker       | `worker_id`  | Machine process   | Reported to Convex during registration |
| Chat Session | `session_id` | Opencode          | Source of truth for session identity   |

**Rationale**

- **Predictable IDs**: nanoid provides consistent, URL-safe identifiers
- **Decoupled from DB**: Not dependent on Convex's internal ID scheme
- **Session Resumption**: Opencode session IDs can be used directly without translation
- **Cross-system Identity**: IDs are meaningful across system boundaries

**Convex Internal IDs**

- Convex-generated IDs are ignored for business logic
- Used only for internal DB operations (indexes, relations)
- All queries/mutations use the custom IDs as primary identifiers

## Discussion Notes

_Additional notes and open questions._
