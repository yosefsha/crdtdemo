import openai
import json
import os
from IPython.display import HTML, display

MODEL ="gpt-4o-mini"
# get api key from json file in secrets folder
token = ""
try:
    cwd = os.getcwd()
    print(f"Current working directory: {cwd}")
    fp = open('secrets/apiconf.json')
    data = json.load(fp)
    token = data['openai']['api_token']
except Exception as e:
    print(f"Error loading API config: {e}")
    raise
#  set env variables
os.environ["OPENAI_API_KEY"] = token
client = openai.OpenAI(api_key=token)

def get_completion(prompt, model=MODEL, temperature=0):
    messages = [{"role": "user", "content": prompt}]
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature
    )
    return response.choices[0].message.content

"""
this function retrieves the completion for a given prompt and model.
params:
- messages: the input messages to generate a response for general form is one of: 
[{"role":"system", "content": "<system_message>"},
{"role": "user", "content": "<user_message>"},
 {"role": "assistant", "content": "<assistant_message>"},
 {"role": "user", "content": "<user_message_2>"},
 {"role": "assistant", "content": "<assistant_message_2>"
}]
a role can be one of ["user" or "assistant" or "system"]
- model: the model to use for generation (default: "gpt-3.5-turbo")
- temperature: the degree of randomness in the output (default: 0)
"""
def get_completion_from_messages(messages, model=MODEL, temperature=0):
    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        temperature=temperature, # this is the degree of randomness of the model's output
    )
#     print(str(response.choices[0].message))
    return response.choices[0].message["content"]


def get_single_completion(target_text, action_text):
    prompt = f"""
    {action_text}
    Text to process:
    ```{target_text}```
    """
    return get_completion(prompt)

def run_bot():
    history = [{"role": "system", "content": "You are a bot that is responsible for taking orders of a pizza from user"}]
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in {"exit", "quit"}:
            print("Bye!")
            break

        history.append({"role": "user", "content": user_input})

        resp = client.chat.completions.create(
            model=MODEL,
            messages=history,
            temperature=0.05,
        )

        assistant_msg = resp.choices[0].message.content
        print(f"Bot: {assistant_msg}\n")
        history.append({"role": "assistant", "content": assistant_msg})

def refine_resume():
    messages = [{"role":"system", "content": "the following test is a text version \n"
    " of a resume for mid level back end software developer"},
{"role": "user", "content": "Please add experience in automates testing,"+
" jest and mocha for javascript and Xctewst for swift, make the addition as short as possible"
"check complience with ATS systems"},

]
    with open('openplayground/ResumeBtext.txt', 'r') as f:
        resume_text = f.read()
    action = ""
    response = get_single_completion(resume_text, action)
    print(response)
    with open('ResumeBtext_refined.txt', 'w') as f:
        f.write(response)

def main():
    # target_text = f"""
    # You should express what you want a model to do by \ 
    # providing instructions that are as clear and \ 
    # specific as you can possibly make them. \ 
    # This will guide the model towards the desired output, \ 
    # and reduce the chances of receiving irrelevant \ 
    # or incorrect responses. Don't confuse writing a \ 
    # clear prompt with writing a short prompt. \ 
    # In many cases, longer prompts provide more clarity \ 
    # and context for the model, which can lead to \ 
    # more detailed and relevant outputs.
    # """
    # action =   "Summarize the text use max 100 characters"
    text = f"""
This text describes key tour guide characteristics including:

Knowledge & Expertise: Local history, culture, geography
Communication: Storytelling, engaging narratives
Leadership: Group management, energy, enthusiasm
Cultural Sensitivity: Respect for customs, adaptability
Organization: Logistics, punctuality, coordination
Crisis Management: Handling unexpected situations
Passion: Genuine care for guest experiences
    """

    action = """Extract the key characteristics in a JSON formatted point list \n
    use list object for values that include multiple items
    """
    # result = get_single_completion(text, action)
    # print(result)
    # ac2 = "convert the following JSON into HTML format"
    # result2 = get_single_completion(result, ac2)
    # with open('output.html', 'w', encoding='utf-8') as f:
    #     f.write(result2)
    refine_resume()
if __name__ == "__main__":
    main()

