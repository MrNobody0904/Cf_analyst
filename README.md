# Cf_analyst
profile analyzer for Codeforces competitors. Get immediate, visually rich analytics on lookups, solving patterns, tag tracking, and difficulty distribution.




FLOW CHART OF app.js 
 Parameters
    ↓
 Create string toHash
    ↓
 Convert string → bytes
    ↓
 SHA-512 hash
    ↓
 Convert hash → hex
    ↓
 Prepend random number
    ↓
 apiSig generated
    ↓
 Return signed URL
    ↓
 fetch(url)
