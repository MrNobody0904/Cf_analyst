# CF Analyst

A profile analytics tool for Codeforces competitors that provides instant, visually rich insights into user performance. It analyzes solving patterns, problem tags, difficulty distribution, contest history, and overall progress to help users track and improve their competitive programming journey.

## app.js Flow

Parameters
↓
Generate `toHash` string
↓
Convert string to bytes
↓
Apply SHA-512 hashing
↓
Convert hash to hexadecimal format
↓
Prepend a random number
↓
Generate `apiSig`
↓
Create signed API URL
↓
`fetch(url)`
↓
Process API response
