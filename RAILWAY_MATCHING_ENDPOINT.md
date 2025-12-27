# Matching Endpoint Instructions for Railway

## What It Does
The `/api/match` endpoint runs the matching algorithm to match all groups that have completed profiles with Mandy. It:
- Finds the best overall match between all groups
- Finds top 3 matches for each group
- Saves all matches to the database
- Returns a summary of all matches created

## How to Use

### Option 1: Click the URL (Easiest)
1. Get your Railway app URL (should be something like: `https://your-app-name.railway.app`)
2. Visit: `https://your-app-name.railway.app/api/match`
3. Wait for the response (takes 1-5 minutes depending on number of groups)
4. You'll see a JSON response with all matches

### Option 2: Use curl
```bash
curl https://your-app-name.railway.app/api/match
```

### Option 3: Use Postman/HTTP Client
- Method: GET or POST (both work)
- URL: `https://your-app-name.railway.app/api/match`
- Headers: None required

## What You'll Get Back

The endpoint returns JSON with:
- `success`: true/false
- `message`: Status message
- `summary`: 
  - `totalGroups`: Number of groups processed
  - `totalMatches`: Number of matches created
  - `bestMatch`: Best overall match with compatibility score
- `matchesByGroup`: Top matches for each group
- `allMatches`: Complete list of all matches

## Example Response
```json
{
  "success": true,
  "message": "Matching completed successfully",
  "summary": {
    "totalGroups": 9,
    "totalMatches": 19,
    "bestMatch": {
      "group1": "Beach Crew",
      "group2": "Surf Squad",
      "compatibility": 90,
      "breakdown": {
        "quantitative": 83,
        "qualitative": 95,
        "sizeMatch": 100
      }
    }
  },
  "matchesByGroup": { ... },
  "allMatches": [ ... ]
}
```

## Prerequisites
- Server must be deployed and running on Railway
- Need at least 2 groups with completed profiles (Mandy has finished interviewing them)
- Claude API key must be configured (required for qualitative matching)

## To View Matches Later
After running the matching endpoint, you can view saved matches:
```
GET https://your-app-name.railway.app/api/matches
```

## To View All Group Profiles
```
GET https://your-app-name.railway.app/api/groups
```

## Notes
- Matching takes 1-5 minutes depending on number of groups (each pair comparison uses AI)
- The endpoint clears old matches and creates fresh ones each time it runs
- Groups are matched based on:
  - Group size similarity (40% weight)
  - AI analysis of vibe, interests, and personality (60% weight)

