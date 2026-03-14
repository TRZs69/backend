# Gamified Learning App Backend

This repository contains the backend code for a gamified learning application, built using Express.js, Node.js, MySQL, and Prisma.  It provides a REST API for managing users, courses, progress, rewards, and other game-related functionalities.

## Table of Contents

- [Introduction](#introduction)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)

## Introduction

This backend application serves as the core logic for a gamified learning platform. It handles data persistence, user authentication, authorization, and the business rules for awarding points, badges, and other rewards based on user progress.  The API is designed to be consumed by a frontend application (React for Web, and Flutter for Mobile).

## Technologies Used

- **Node.js:** JavaScript runtime environment
- **Express.js:** Web framework for Node.js
- **MySQL:** Relational database management system
- **Prisma:** ORM (Object-Relational Mapper) for database access
- **Postman:** Tool for testing API endpoints
- **NPM/Yarn:** Package manager

## Features

- User Management
- Course management
- Chapter Management
- Material Management (Included in Chapter)
- Assessment Management (Included in Chapter)
- Assignment Management (Included in Chapter)

## Installation

1. **Clone the repository:**

    ```
    git clone [https://github.com/TA-2425-13/backend.git](https://github.com/TA-2425-13/backend.git)
    ```

2. **Navigate to the project directory:**

    ```bash
   cd backend

3. **Install dependencies:**

    ```bash
   npm install  # or yarn install

4. **Configure the database connection:**

    - Create a `.env` file in the root directory.
    - Create a database in MySQL named `graphci`
    - Copy this code into the `.env` file, and adjust the value with your database
        ```
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=root
        DB_DATABASE=graphci
        JWT_SECRET=your_secret_token

        DATABASE_URL="mysql://root:root@localhost:3306/graphci"
        ```
    - Make sure there's definition of `require('dotenv').config();` in the `index.js` file.

4. **Generate Prisma Client:**

    ```bash
   npx prisma generate

5. **Run Database Migrations:**

    ```bash
   npx prisma migrate dev --name init

   
6. **Run Database Seeder:**

    ```bash
   npx prisma db seed

## Running The Application

    ```
    nodemon run dev
    ```

## Production migrations

Do not run Prisma migrations as part of the Vercel build step. This repository keeps Vercel builds limited to Prisma client generation so deployments are not blocked by existing database migration state.

Apply production schema changes separately with direct database access:

```bash
npm run db:migrate:deploy
```

If Prisma reports `P3009` because a previous migration failed, follow the recovery steps in `docs/prisma-production-recovery.md` before retrying the deploy.

## API Documentation

Base URL:
`http://localhost:3000/api/`

| Features  | Function  | Method    | Endpoint      | Body      |
| --------  | --------- |---------- |-------------- | --------  |
| User      | Get All Users | GET       | `/user`       | -   |
| User    | Get User by ID | GET       | `/user/:id`   | -  |
| User    | Create User | POST      | `/user`       | `{name, username, password, role, studentId, points, student_course, student_badge, instructor_id, instructor_course}` |
| User    | Update User | PUT       | `/user/:id`   | `{name, username, password, role, studentId, points, student_course, student_badge, instructor_id, instructor_course}`    |
| User    | Delete User | DELETE    | `/user/:id`   |   -     |
| Course        | Get All Courses       | GET           | `/course`         | -                       |
| Course        | Get Course By Id      | GET           | `/course/:id`     | -                       |
| Course        | Create Course         | POST          | `/course`         | `{code, name}`          |
| Course        | Edit Course           | PUT           | `/course/:id`     | `{code, name}`          |
| Course        | Delete Course         | DEL           | `/course/:id`     | -                       |
| Course        | Get Chapter By Course | GET           | `/course/:id/chapters`    | -               |
| Course        | Get Users By Course   | GET           | `/course/:id/users`       | -               |
| Chapter       | Get All Chapter       | GET           | `/chapter`        | -                       |
| Chapter       | Get Chapter By Id     | GET           | `/chapter/:id`    | -                       |
| Chapter       | Create Chapter        | POST          | `/chapter`        | `{code, name}`          |
| Chapter       | Edit Chapter          | PUT           | `/chapter/:id`    | `{code, name}`          |
| Chapter       | Delete Chapter        | DEL           | `/chapter/:id`    | -                       |
| Chapter       | Get Content By Chapter        | GET   | `/chapter/:id/content `   | -               |
| Chapter       | Get Materials By Chapter      | GET   | `/chapter/:id/materials`  | -               |
| Chapter       | Get Assessments By Chapter    | GET   | `/chapter/:id/assessments`| -               |
| Chapter       | Get Assignments By Chapter    | GET   | `/chapter/:id/assignments`| -               |
| Material      | Get All Materials     | GET           | `/material`         | -                     |
| Material      | Get Material By Id    | GET           | `/material/:id`     | -                     |
| Material      | Create Material       | POST          | `/material`         | `{name, content}`     |
| Material      | Edit Material         | PUT           | `/material/:id`     | `{name, content}`     |
| Material      | Delete Material       | DEL           | `/material/:id`     | -                     |
| Assessment    | Get All Assessments   | GET           | `/assessment`       | -                     |
| Assessment    | Get Assessment By Id  | GET           | `/assessment/:id`   | -                     |
| Assessment    | Create Assessment     | POST          | `/assessment`       | `{instruction, order, question, answer}`          |
| Assessment    | Edit Assessment       | PUT           | `/assessment/:id`   | `{instruction, order, question, answer}`          |
| Assessment    | Delete Assessment     | DEL           | `/assessment/:id`   | -                     |
| Assignment    | Get All Assignments   | GET           | `/assignment`       | -                     |
| Assignment    | Get Assignment By Id  | GET           | `/assignment/:id`   | -                     |
| Assignment    | Create Assignment     | POST          | `/assignment`       | `{instruction, file}` |
| Assignment    | Edit Assignment       | PUT           | `/assignment/:id`   | `{instruction, file}` |
| Assignment    | Delete Assignment     | DEL           | `/assignment/:id`   | -                     |