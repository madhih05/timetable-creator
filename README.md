# School Timetable Scheduler

A powerful, web-based tool built with **Node.js** to manage, generate, and view school timetables. It features intelligent **collision detection**, a **randomized greedy auto-scheduler**, and a read-only **view mode** for staff and students.

## ✨ Features

- **Interactive Grid:** Click-to-edit timetable slots with smart dropdowns.
- **Real-time Validation:** Circular progress bars track subject limits and prevent over-booking.
- **Collision Detection:** Instantly flags if a teacher is assigned to two different subjects at the same time.
- **Auto-Scheduler:** Automatically fills empty slots using a randomized greedy algorithm while respecting constraints.
- **Combined Classes:** Automatically groups classes together if they share the same Subject + Teacher (e.g., Combined Math Lecture).
- **Dual Views:** Switch between **Class View** (Student perspective) and **Staff View** (Teacher perspective).
- **Read-Only Mode:** A dedicated `/view` page with a multi-select filter for public display.
- **Excel Export:** Includes a Python script to convert the JSON data into a multi-sheet `.xlsx` file.

---

## 📂 Project Structure

Plaintext

```
timetable-app/
├── data/
│   └── school_data.json       # The database (stores all schedule info)
├── public/
│   ├── css/
│   │   └── style.css          # Styling for both Admin and View modes
│   ├── js/
│   │   ├── app.js             # Admin logic (Editing, Auto-fill, Validation)
│   │   └── view.js            # View-only logic (Filtering, Rendering)
│   ├── index.html             # Admin Dashboard (Edit Mode)
│   └── view.html              # Read-Only Dashboard (View Mode)
├── json_to_excel.py           # Python script to convert JSON export to Excel
├── server.js                  # Node.js Backend Server
├── package.json               # Dependencies list
└── README.md                  # Project Documentation
```

---

## 🚀 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) installed.
- (Optional) Python 3 installed (for Excel export feature).

### 1. Install Dependencies

Open your terminal in the project folder and run:

Bash

```
npm install
```

_If `package.json` is missing, initialize it first:_

Bash

```
npm init -y
npm install express body-parser cors
```

### 2. Start the Server

Bash

```
node server.js
```

The server will start at `http://localhost:3000`.

---

## 📖 Usage Guide

### 1. Admin Dashboard (Editing)

- **URL:** `http://localhost:3000`
- **Select Class:** Choose a class from the dropdown to edit its schedule.
- **Manual Entry:** Click any cell to assign a subject. The circular progress bars below the grid show how many periods are left for each subject.
- **Auto-Fill:** Click **"Auto-Fill Remaining"** to let the AI automatically place the remaining lessons without conflicts.
- **Save:** Changes are automatically saved to `data/school_data.json`.

### 2. View Mode (Public)

- **URL:** `http://localhost:3000/view`
- **Filter:** Click "Select Classes" to check multiple classes (e.g., CSE I and CSE II).
- **Display:** The selected timetables will appear stacked on the page, read-only.

### 3. Exporting to Excel

1. On the Admin Dashboard, click **"⬇ Export JSON"**.
2. Save the file as `final_timetable.json` in your project folder.
3. Run the Python script:

   Bash

   ```
   python3 json_to_excel.py
   ```

4. This generates `School_Timetable_Final.xlsx` with separate sheets for Classes and Staff.

---

## 💾 Data Format (`school_data.json`)

The application relies on a specific JSON structure. You can edit `data/school_data.json` directly to set up your school's requirements.

### Structure Overview

JSON

```
{
  "setup": {
    "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periods_per_day": 8
  },
  "allocations": [
    {
      "class_name": "Class Name Here",
      "subjects": [
        {
          "subject": "Subject Name",
          "teacher": "Teacher Name",
          "periods": 5
        }
      ]
    }
  ],
  "grid": {}
}
```

### Fields Explained

| **Field**                    | **Description**                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **setup.days**               | An array of strings defining the columns of the timetable (e.g., Mon-Fri).                                         |
| **setup.periods_per_day**    | Integer defining how many rows (periods) exist per day.                                                            |
| **allocations**              | The core constraints list. Each object represents a **Class**.                                                     |
| **allocations[].class_name** | The unique name of the class (e.g., "10-A").                                                                       |
| **allocations[].subjects**   | List of subjects this class _must_ take.                                                                           |
| **...subject**               | Name of the subject (e.g., "Math").                                                                                |
| **...teacher**               | Name of the staff member (e.g., "MR. SMITH"). _Must be consistent across classes for collision detection to work._ |
| **...periods**               | Total number of periods this subject needs per week.                                                               |
| **grid**                     | **Do not edit manually.** This is where the app saves the actual schedule positions.                               |

### Example Allocation

JSON

```
{
  "class_name": "CSE II",
  "subjects": [
    { "subject": "OS", "teacher": "MS. FEMILA", "periods": 5 },
    { "subject": "DBMS", "teacher": "MR. MADHU", "periods": 5 }
  ]
}
```

---

## 🧠 How the Algorithm Works

1. **Constraint Satisfaction:** The logic ensures that a Teacher cannot be in two places at once.
2. **Combined Classes:** If `MR. SMITH` teaches `MATH` to `Class A` and `Class B`:

   - The collision checker allows this overlap.
   - The Auto-Filler treats these two requirements as a single "block" and finds a time slot where `Smith`, `Class A`, and `Class B` are **all** free.

3. **Randomized Greedy Search:** The auto-fill function shuffles the list of remaining lessons and tries to fit them into random valid slots. If it gets stuck, it retries up to 100 times to find a valid solution.

---

## 🛠 Troubleshooting

- **"Limit Reached" Alert:** You are trying to add more periods for a subject than defined in `allocations`. Increase the period count in the JSON file if needed.
- **Collision Detected:** A teacher is assigned to different subjects at the same time. Check the "Staff View" to debug.
- **Changes not saving:** Ensure the Node.js server is running and has write permissions to the `data/` folder.
