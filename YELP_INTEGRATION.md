# Yelp API Integration

Mandy now uses the Yelp Fusion API to provide real-time business recommendations, ratings, and reviews for activity planning.

## Setup

### 1. Get Yelp API Key

1. Go to [Yelp Developers](https://www.yelp.com/developers)
2. Create a Yelp account or log in
3. Create a new app
4. Copy your API key (Bearer token)

### 2. Set Environment Variable

Add to your `.env` file or Railway environment variables:

```env
YELP_API_KEY=your_yelp_api_key_here
```

### 3. Verify Configuration

The service will automatically detect if Yelp is configured:
- ✅ If `YELP_API_KEY` is set → Uses Yelp API for business searches
- ⚠️  If not set → Falls back to web search and helpful links

## Features

### What Yelp Provides

- **Real-time business data**: Names, addresses, phone numbers
- **Ratings & reviews**: Star ratings and review counts
- **Price levels**: $, $$, $$$, $$$$
- **Photos**: Business images
- **Categories**: Business types (restaurants, activities, etc.)
- **Distance**: Calculated distance from location
- **Hours**: Operating hours
- **Yelp links**: Direct links to business pages

### Supported Searches

Mandy can help find:
- **Restaurants**: Italian, Mexican, Chinese, Thai, Sushi, Pizza, etc.
- **Activities**: Mini golf, escape rooms, bowling, arcades
- **Entertainment**: Movies, concerts, events
- **Any business type**: Just ask Mandy!

## Usage Examples

Users can ask Mandy:
- "Where should we go for Italian food?"
- "Find a good restaurant in Boston"
- "What are some fun activities near Harvard Square?"
- "Mandy, where can we get pizza?"
- "Find mini golf near me"

Mandy will:
1. Extract the activity type (e.g., "italian restaurant")
2. Extract or ask for location
3. Search Yelp API for top-rated businesses
4. Return formatted recommendations with:
   - Business names
   - Ratings (⭐)
   - Review counts
   - Addresses
   - Distance
   - Links to Yelp pages

## API Endpoints Used

### Business Search
```
GET /v3/businesses/search
```
- Searches for businesses by term and location
- Returns top-rated results
- Supports filtering by price, distance, etc.

### Business Details
```
GET /v3/businesses/{id}
```
- Gets detailed business information
- Includes hours, photos, full address

### Reviews
```
GET /v3/businesses/{id}/reviews
```
- Gets up to 3 review excerpts
- Includes reviewer names and ratings

### Delivery Search
```
GET /v3/transactions/delivery/search
```
- Finds businesses that offer delivery
- Location-based delivery availability

## Rate Limiting

Yelp API has rate limits:
- **Free tier**: 5,000 calls/day
- **Paid tiers**: Higher limits available

The service handles rate limit errors gracefully and falls back to web search if needed.

## Fallback Behavior

If Yelp API is not configured or fails:
- ✅ Service still works
- ✅ Uses web search for results
- ✅ Provides helpful links (Google Maps, Yelp website)
- ✅ Returns formatted recommendations

## Testing

To test the Yelp integration:

1. Set `YELP_API_KEY` in your environment
2. Start the server
3. Ask Mandy: "Where should we go for Italian food in Boston?"
4. Verify you get real Yelp results with ratings and addresses

## Code Structure

- **`services/yelp-service.js`**: Yelp API client
  - `searchBusinesses()`: Search for businesses
  - `getBusinessDetails()`: Get business details
  - `getBusinessReviews()`: Get reviews
  - `formatBusiness()`: Format business data

- **`services/activity-planning-service.js`**: Activity planning logic
  - Uses Yelp service if configured
  - Falls back to web search if not
  - Formats recommendations for Mandy

## Example Response

When a user asks "Where should we go for Italian food in Boston?", Mandy will respond with:

```
Here are some great options for best italian restaurant near Boston:

1. **Giacomo's Restaurant** ⭐ 4.5 (1,234 reviews)
   📍 355 Hanover St, Boston, MA 02113
   📏 0.5 mi away
   🔗 View on Yelp: https://www.yelp.com/biz/...

2. **Carmelina's** ⭐ 4.5 (890 reviews)
   📍 307 Hanover St, Boston, MA 02113
   📏 0.6 mi away
   🔗 View on Yelp: https://www.yelp.com/biz/...

🔗 Quick links:
• Google Maps - See all options with reviews and directions
• Yelp - Find more options with ratings
```

## Troubleshooting

### "Yelp API key not configured"
- Check that `YELP_API_KEY` is set in environment variables
- Verify the key doesn't contain placeholder text like "your_yelp_api_key_here"

### "Yelp API error"
- Check API key is valid
- Verify you haven't exceeded rate limits
- Check network connectivity
- Service will automatically fall back to web search

### No results returned
- Verify location is provided (city name, address, etc.)
- Try a more specific search term
- Check that businesses exist in that location
