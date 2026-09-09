from groq import Groq
import wmill

# TODO docs: https://console.groq.com/docs/quickstart

groq_api_key = wmill.get_variable("u/Alp/GROQ_API_KEY")

def main():
    client = Groq(
        api_key=groq_api_key,
    )

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Explain the importance of fast language models",
            }
        ],
        model="llama3-8b-8192",
    )

    print(chat_completion.choices[0].message.content)
    