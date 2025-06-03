import requests
from requests_oauthlib import OAuth1Session

import datetime
import os
import json
# Set your Bearer Token here
BEARER_TOKEN = "YOUR_TWITTER_BEARER_TOKEN" # read token from config file located in ../secrets/config.json
# or environment variable
# BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN")
# Alternatively, you can read the token from a config file
print("Working Directory 11:", os.getcwd())

# change to current file dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

path = "./secrets/apiconf.json"
print("Working Directory 22:", os.getcwd())
if os.path.exists(path):
    print(f"The path '{path}' exists.")
else:
    print(f"The path '{path}' does not exist.")

with open(path) as f:
    config = json.load(f)
    BEARER_TOKEN = config.get("twitter", {}).get("bearer_token")
# Ensure the token is set
if not BEARER_TOKEN:
    raise ValueError("Bearer token is not set. Please set it in the script.")
else :
    print('will use {} barear token'.format(BEARER_TOKEN))

def get_user_id(username):
    url = f"https://api.twitter.com/2/users/by/username/{username}"
    headers = {"Authorization": f"Bearer {BEARER_TOKEN}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()["data"]["id"]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching user ID for username '{username}': {e}")
        print(f"Response content: {response.text if response else 'No response'}")
        raise

def get_tweets(user_id, start_time, end_time, include_attachments=False):
    url = f"https://api.twitter.com/2/users/{user_id}/tweets"
    headers = {"Authorization": f"Bearer {BEARER_TOKEN}"}
    params = {
        "max_results": 100,
        "start_time": start_time,
        "end_time": end_time,
        "tweet.fields": "created_at,attachments",
        "expansions": "attachments.media_keys" if include_attachments else None,
        "media.fields": "type,url"
    }

    tweets = []
    while True:
        try:
            response = requests.get(url, headers=headers, params={k: v for k, v in params.items() if v})
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching tweets for user ID '{user_id}': {e}")
            print(f"Response content: {response.text if response else 'No response'}")
            raise

        for tweet in data.get("data", []):
            if include_attachments and "attachments" not in tweet:
                continue
            tweets.append(tweet)

        if "next_token" in data.get("meta", {}):
            params["pagination_token"] = data["meta"]["next_token"]
        else:
            break

    return tweets

if __name__ == "__main__":
    username = "shachnovsky"
    # ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    start_time = "2024-01-01T00:00:00Z"
    end_time = "2024-12-31T23:59:59Z"
    filter_attachments = True  # Set to False if you don't want to filter

    user_id = get_user_id(username)
    print(f"User ID for '{username}': {user_id}")
    tweets = get_tweets(user_id, start_time, end_time, include_attachments=filter_attachments)

    for t in tweets:
        print(f"{t['created_at']}: {t['text']}")
