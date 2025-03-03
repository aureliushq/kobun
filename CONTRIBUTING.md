# Contributing to Kobun

Thank you for contributing, you rock star!

Here are a few guidelines to help you as you prepare your contribution.

## Setup

Make a fork of this repo and clone your fork locally.

Clone the project

```bash
git clone https://github.com/<your-github-username>/kobun.git
```

Go to the project directory

```bash
cd kobun
```

Install dependencies. Kobun uses [Bun](https://bun.sh) as its package manager so I recommend you use it to.

```bash
bun install
```

Start the server

```bash
bun run dev
```

Kobun is a monorepo with multiple packages. They're managed by Turborepo. In addition to the packages, the monorepo also includes a demo workspace that can be used to test features and bug fixes. Make sure you run the development server and go to [http://localhost:5173](http://localhost:5173)

Before you open a pull request, make sure Kobun builds without errors

```bash
bun run build
```
