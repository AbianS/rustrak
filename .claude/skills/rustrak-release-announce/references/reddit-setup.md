# Reddit API Setup

## Create a Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Click **"create another app..."** at the bottom
3. Fill in:
   - **Name:** rustrak-announce (or anything)
   - **Type:** select **script**
   - **Redirect URI:** `http://localhost:8080`
4. Click **Create app**
5. Copy the **client_id** (under the app name, short string) and **client_secret**

## Get a Refresh Token

Run this once from your terminal (needs PRAW installed):

```bash
uv run --with praw python3 -c "
import praw, webbrowser

reddit = praw.Reddit(
    client_id='YOUR_CLIENT_ID',
    client_secret='YOUR_CLIENT_SECRET',
    redirect_uri='http://localhost:8080',
    user_agent='rustrak-setup/1.0'
)

scopes = ['submit', 'identity']
url = reddit.auth.url(scopes=scopes, state='setup', duration='permanent')
print('Open this URL:', url)
webbrowser.open(url)

code = input('Paste the ?code= value from the redirect URL: ')
refresh_token = reddit.auth.authorize(code)
print('Your refresh_token:', refresh_token)
"
```

## Fill in `.announce.config.toml`

```toml
[reddit]
client_id = "your_client_id_here"
client_secret = "your_client_secret_here"
refresh_token = "your_refresh_token_here"
user_agent = "rustrak-announce/1.0 by u/YOUR_REDDIT_USERNAME"

subreddits = [
  "selfhosted",
]
```

## Test Without Posting

Run with `--dry-run` to verify credentials and subreddit list without submitting:

```bash
uv run scripts/post_to_reddit.py \
  --config .announce.config.toml \
  --title "Test" \
  --body-file /dev/stdin \
  --dry-run <<< "Test body"
```
