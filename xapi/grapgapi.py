import requests
import os
import json

ACCESS_TOKEN = ''  # Replace with your token
PAGE_ID = 'YOUR_PAGE_ID'  # Replace with your page ID or use 'me'
GRAPH_API_VERSION = 'v22.0'  # Or the latest stable version
APP_ID = '1298088334980672'  # Replace with your App ID
os.chdir(os.path.dirname(os.path.abspath(__file__)))

path = "./secrets/apiconf.json"
print("Working Directory 22:", os.getcwd())
if os.path.exists(path):
    print(f"The path '{path}' exists.")
else:
    print(f"The path '{path}' does not exist.")
with open(path) as f:
    config = json.load(f)
    ACCESS_TOKEN = config.get("graph", {}).get("access_token")
# Ensure the token is set
if not ACCESS_TOKEN:
    raise ValueError("ACCESS_TOKEN token is not set. Please set it in the script.")
else :
    print('will use {} barear token'.format(ACCESS_TOKEN))

def get_my_user():
    """Fetch the user ID for the access token."""
    url = f'https://graph.facebook.com/{GRAPH_API_VERSION}/me'
    params = {'access_token': ACCESS_TOKEN}
    try:
        response = requests.get(url, params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching user ID: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise

# Fields to retrieve
def get_photos(user_id):
    """Fetch photos from a Facebook page."""
    if not ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is not set. Please set it in the script.")
    
    # url = "https://graph.facebook.com/{}/photos?access_token={}&fields=id,name,created_time,images&limit=10".format(GRAPH_API_VERSION, ACCESS_TOKEN)
    print(f"Fetching photos for user ID: {user_id}")
    url = "https://graph.facebook.com/me/photos"
    fields = 'id,created_time,name,images,album'

    params = {
        'access_token': ACCESS_TOKEN,
        'fields': fields,
        'type': 'uploaded',
        'limit': 100  # Max items per page
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json().get('data', [])
       
    except requests.exceptions.RequestException as e:
        print(f"Error fetching photos: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise
def get_posts():
    """Fetch posts from a Facebook page."""
    if not ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is not set. Please set it in the script.")
    
    # Define the fields to retrieve
    fields = 'message,created_time,attachments{media_type,media,url,subattachments},id'

    url = f'https://graph.facebook.com/{GRAPH_API_VERSION}/{PAGE_ID}/posts'
    params = {
        'access_token': ACCESS_TOKEN,
        'fields': fields,
        'limit': 10  # Limit the number of posts
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        for post in data.get('data', []):
            print(f"\n📝 Post ID: {post['id']}")
            print(f"🕒 Created: {post.get('created_time')}")
            print(f"📄 Message: {post.get('message', '[No message]')}")

        attachments = post.get('attachments', {}).get('data', [])
        for att in attachments:
            print(f"📎 Attachment type: {att.get('media_type')}")
            print(f"🔗 URL: {att.get('url')}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching posts: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise

def get_page_info():
    """Fetch basic information about the Facebook page."""
    if not ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is not set. Please set it in the script.")
    
    url = f'https://graph.facebook.com/{GRAPH_API_VERSION}/{PAGE_ID}'
    params = {
        'access_token': ACCESS_TOKEN,
        'fields': 'id,name,about,description,fan_count'
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page info: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise

def get_page_posts():
    """Fetch posts from a Facebook page."""
    if not ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is not set. Please set it in the script.")
    
    url = f'https://graph.facebook.com/{GRAPH_API_VERSION}/{PAGE_ID}/posts'
    params = {
        'access_token': ACCESS_TOKEN,
        'fields': 'id,message,created_time,attachments',
        'limit': 10  # Limit the number of posts
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page posts: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise
    """Fetch posts from a Facebook page."""
    if not ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is not set. Please set it in the script.")
    
    url = f'https://graph.facebook.com/{GRAPH_API_VERSION}/{PAGE_ID}/posts'
    params = {
        'access_token': ACCESS_TOKEN,
        'fields': 'id,message,created_time,attachments',
        'limit': 10  # Limit the number of posts
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page posts: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise

def get_foo():
    """Placeholder function for future use."""
    url = "https://www.facebook.com/v22.0/dialog/oauth?"
    params = { 
        "client_id": APP_ID,  # Replace with your App ID
        "redirect_uri": "https://developers.facebook.com/tools/explorer/callback",
        "scope": "pages_read_engagement,pages_read_user_content,public_profile",
        "response_type": "token"
    }
        
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching foo: {e}")
        if response:
            print(f"Response content: {response.text}")
        raise






if __name__ == "__main__":
    user_info = get_my_user()
    print(f"User ID: {user_info['id']}, Name: {user_info['name']}")
    photos = get_photos(user_info['id'])
    res = get_foo()
    print("res:", res)
    print("Fetching photos...")
    print(f"User ID: {user_info['id']}, Name: {user_info['name']}")
    print(f"Fetched {len(photos)} photos from the user.")
    for photo in photos:
        print(f"Photo ID: {photo['id']}, Created Time: {photo.get('created_time', 'N/A')}")
    print("Graph API script executed successfully.")
# This script fetches posts from a Facebook page using the Graph API.
# It retrieves the post message, creation time, and any attachments.
