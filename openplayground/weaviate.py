import weaviate
import os
import json


token = ""
try:
    cwd = os.getcwd()
    print(f"Current working directory: {cwd}")
    with open('secrets/apiconf.json') as fp:
        token = json.load(fp)['openai']['api_token']
except Exception as e:
    print(f"Error loading API config: {e}")
    raise
#  set env variables
os.environ["OPENAI_API_KEY"] = token


client = weaviate.connect_to_embedded(
    version="1.26.1",
    headers={
        "X-OpenAI-Api-Key": token
    },
)