# HACK-TECHNICOLOR

## Description
This project is a tool for automating the deactivation of 'hidden' wifi networks on Technicolor CGA4233xxx modems. I did this to hide the 'Personal WiFi Zone' networks that Personal Flow enables without a direct way to disable them.

## Project Setup

To run this project, you will need to have the following tools installed:

- Node.js
- TypeScript (tsc)
- ts-node

## Running the Tool
First of all, install packages:
```bash
npm i
```

## Usage
To run the tool, use one of the following commands:

### Using ``npm``
```bash
npm start -- -H 192.168.0.1 -u user -p pass
npm start -- -h
```

### Using ``ts-node``
```bash
ts-node src/index.ts -H 192.168.0.1 -u user -p pass
ts-node src/index.ts -h
```
