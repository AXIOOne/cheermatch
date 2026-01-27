

# CheerMatch Platform Rebuild

A comprehensive virtual cheerleading competition platform with admin management, judge scoring, gym/coach portals, and mobile video submission.

---

## Phase 1: Foundation & Admin Dashboard

### Authentication & User Management
- Secure login system with role-based access (Admin, Judge, Gym/Coach)
- User invitation system for admins to add judges and gym owners
- Profile management for each user type

### Admin Dashboard
- **Event Management**: Create, edit, and archive competitions (name, dates, divisions, levels, registration deadlines)
- **Division/Level Configuration**: Set up competition categories (Youth, Junior, Senior, Open) and skill levels (1-6+)
- **Scoring Template Builder**: Create custom rubrics with weighted categories (stunts, tumbling, jumps, dance, performance, etc.)
- **Team Overview**: View all registered teams, filter by event/division/level
- **Judge Assignment**: Assign judges to specific divisions or performances
- **Results Management**: Review scores, handle ties, and manually publish results

---

## Phase 2: Gym/Coach Portal

### Team Registration
- Register teams for events with all required details (team name, gym name, division, level, athlete count)
- View registration status and deadlines
- Edit team information before submission deadline

### Video Submission
- Upload performance videos directly to Brightcove
- View submission status and confirmation
- Re-submit videos if needed (before deadline)

### Results Access
- View published scores and rankings for their teams
- Download score sheets and certificates

---

## Phase 3: Judge Scoring Interface

### Performance Queue
- View assigned performances in order
- Access team information (name, gym, division, level, athlete count)
- Watch embedded Brightcove videos with playback controls (pause, rewind, slow motion)

### Scoring System
- Dynamic scoring form based on the event's custom rubric
- Category-by-category scoring with defined point ranges
- Deduction tracking (legality violations, safety issues)
- Comments/notes field for feedback
- Auto-save progress to prevent data loss
- Submit and lock scores when complete

### Judge Dashboard
- Track completed vs. pending assignments
- View personal scoring history

---

## Phase 4: Mobile App (Capacitor)

### Video Capture
- In-app camera for recording performances
- Video quality settings optimized for judging
- Automatic upload to Brightcove with progress indicator

### Team Selection
- Select event, division, and team before recording
- Auto-populate team details from registration

### Submission Confirmation
- Confirmation screen with video preview
- Status tracking for upload completion

---

## Technical Architecture

### Backend
- **Supabase** for database, authentication, and edge functions
- Secure role-based access with Row Level Security (RLS)
- Edge functions for Brightcove API integration (upload/retrieve videos)

### Frontend
- Modern, responsive web application
- Real-time updates for scoring and results
- Mobile-optimized design for all user types

### Integrations
- **Brightcove**: Video hosting, playback, and upload via their APIs
- Secure API key management for Brightcove credentials

---

## Data Structure Overview

- **Events**: Competition details, dates, settings
- **Divisions/Levels**: Categories within events
- **Scoring Templates**: Custom rubrics linked to events
- **Teams**: Registered teams with gym and athlete info
- **Submissions**: Video links and metadata
- **Scores**: Judge scores linked to rubric criteria
- **Users**: Admins, judges, and gym owners with role assignments

---

## What We'll Build First

Starting with the **Admin Dashboard** as requested:
1. Authentication system with admin role
2. Event creation and management
3. Custom scoring template builder
4. Division and level configuration
5. Basic team viewing (before gym portal exists)

This foundation will set up the database structure and allow you to configure events before we build the judge and gym/coach interfaces.

