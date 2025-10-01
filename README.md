ComfortRead - The Intelligent, All-in-One Document Reader

ComfortRead is a modern, feature-rich browser extension designed to be the ultimate destination for reading, annotating, and collaborating on all your digital documents. Moving beyond simple file viewers, ComfortRead integrates a powerful, scalable architecture with plans for AI-powered insights, cloud synchronization, and real-time collaboration.

This project is currently undergoing a strategic migration from a vanilla JavaScript prototype to a robust application built with React and a feature-first architecture.
Core Features

Our goal is to create a seamless experience across all your documents.
Viewing & Reading

    Multi-Format Support: Natively view PDF, EPUB, CBR, CBZ, Markdown (.md), and Plain Text (.txt) files.

    High-Performance Rendering: Built with virtualization to ensure smooth scrolling and fast load times, even for documents with thousands of pages.

    Customizable Reader Theme: Adjust background colors, invert themes, and apply grayscale filters for maximum reading comfort.

    Advanced Spread Modes: Intelligently displays single pages, double-page spreads, and manga (right-to-left) layouts.

Annotations & Note-Taking

    Full Annotation Suite: A simple yet powerful set of tools including highlighting, free-form pencil drawing, text notes, and image insertions.

    Persistent & Portable: Annotations are saved and tied to the document, ready for future syncing and sharing.

Future Vision & Roadmap

    CYOWC (Carry Your Own Cloud): A local-first synchronization system using IndexedDB, with optional cloud backup and sync via Firebase Firestore. Your data is always available offline and securely synced when you're online.

    Live Collaboration & Meet:

        Live Share: Real-time annotation, text editing, and presence/cursor sharing powered by Liveblocks.

        Live Meet: Free, peer-to-peer video and audio calls integrated directly into the reader, powered by PeerJS and WebRTC.

    AI-Powered Insights:

        Smart Summaries: Generate concise summaries of documents.

        Automated Note-Taking: Convert highlights into structured notes.

        Flashcard Generation: Automatically create study flashcards from your annotations.

    Personal Library: Organize your documents into a searchable, taggable personal library that syncs across your devices.

Getting Started

To get a local copy up and running, follow these simple steps.
Prerequisites

    Node.js (LTS version recommended)

    npm (included with Node.js)

Installation & Setup

    Clone the repository:

    git clone [https://github.com/your-username/comfort-read.git](https://github.com/your-username/comfort-read.git)
    cd comfort-read

    Install NPM packages:

    npm install

    Set Up Environment Variables:
    Create a .env.local file in the root of the project and add your API keys obtained from the setup guide:

    VITE_FIREBASE_CONFIG=your_firebase_config_object_here
    VITE_LIVEBLOCKS_PUBLIC_KEY=pk_your_liveblocks_public_key_here

    Run the Development Server:

    npm run dev

