# I-Venture@ISB API Documentation
- API that responds to queries related to ISB

Before using this Repo use your own OpenAI and Perplexity Keys in reactTest.py or setup environment variables

## Setting up env variables
```bash
nano ~/.bashrc
```
Enter the below lines at the end of the script with the appropriate values
```bash
export SECRET_TOKEN=your_openai_token
export PPLX_KEY=your_perplexity_key
```
Save and close the nano editor by `Ctrl+X` and then enter `Y`
```bash
source ~/.bashrc
```

## Using Postman to Test the Endpoint
### Clone the repo
```bash
git clone https://github.com/SaiGane5/I-Venture-Chatbot.git
```
### Install dependencies
```bash
pip install -r requirements.txt
```
### Start the FastAPI server:

```bash
uvicorn reactTest:app --reload
```
## Open Postman and create a new POST request.
### Postman Setup before querying
Method: `POST`

URL: http://127.0.0.1:8000/api/chat

Headers: 

Content-Type: `application/json`

Body:
```json
{
  "prompt": "Your Query",
  "message_history": {}
}
```

Send the request and you should receive a response with the combined retrieval results.

## Example Postman Request

Method: POST

URL: http://127.0.0.1:8000/api/chat

Headers: 

Content-Type: application/json

Body:
```json
{
  "prompt": "Dlabs CEO",
  "message_history": {}
}
```
Example Response
```json
{
    "rag_response": "The CEO of DLabs at ISB is Saumya Kumar. Saumya Kumar leads the I-Venture @ ISB program and serves as the CEO of DLabs. DLabs is the incubation and acceleration arm of the Indian School of Business (ISB), providing a platform for entrepreneurs to engage with mentors, investors, and academia. Saumya Kumar plays a crucial role in fostering innovation and entrepreneurship among the student and alumni community at ISB. As the Director of I-Venture @ ISB, Saumya Kumar works closely with a team of professionals to create a conducive environment for startups to thrive and grow within the DLabs ecosystem.\n\nAdditionally, the advisory board of DLabs and I-Venture @ ISB includes prominent figures such as Prof. Bhagwan Chowdhry, who is the Faculty Director of I-Venture @ ISB, and Naman Singhal, the CEO of ISB AIC. These individuals, along with Saumya Kumar, play key roles in guiding and supporting startups through their journey of innovation and growth. The team at DLabs, under the leadership of Saumya Kumar, aims to strengthen entrepreneurship and promote a culture of creativity and innovation within the startup community at ISB.\n\nIn conclusion, Saumya Kumar serves as the CEO of DLabs at ISB, overseeing the incubation and acceleration programs that support and nurture startups. Alongside a dedicated team and advisory board, Saumya Kumar plays a pivotal role in creating a vibrant ecosystem for entrepreneurs to network, collaborate, and succeed within the dynamic startup landscape at ISB.",
    "web_response": "I'd be happy to help you with your query about DLabs CEO I-Venture @ ISB.\n\n**DLabs CEO I-Venture @ ISB**\n\nThe CEO of DLabs at the Indian School of Business (ISB) is Saumya Kumar. Saumya Kumar is the Director of I-Venture @ ISB and CEO of DLabs.\n\n**About DLabs**\n\nDLabs is the incubation and acceleration arm of the Indian School of Business (ISB). It provides a state-of-the-art space for entrepreneurs to interact, engage, and collaborate with mentors, investors, and academia. The primary objective of DLabs is to strengthen entrepreneurship and foster innovation among the young in India, including its student and alumni community.\n\n**About I-Venture @ ISB**\n\nI-Venture @ ISB is an initiative that aims to create an ecosystem for entrepreneurs to network, innovate, and grow. It provides a platform for startups to connect with investors, mentors, and academia, and offers various programs and resources to support entrepreneurship and innovation.\n\n**Key People Associated with DLabs and I-Venture @ ISB**\n\n* Saumya Kumar: Director, I-Venture @ ISB & CEO, DLabs\n* Prof. Bhagwan Chowdhry: Faculty Director, I-Venture @ ISB\n* Nagaraj Bolakatti: Sr. Associate Director, DLabs\n* Aakash Chaudhry: MD & Co-Promoter at Aakash Educational Services Ltd, and a member of the Advisory Board of I-Venture @ ISB\n\n**Programs and Initiatives**\n\nDLabs and I-Venture @ ISB offer various programs and initiatives to support startups and entrepreneurs, including:\n\n* Incubation and acceleration programs\n* Mentorship and networking opportunities\n* Access to funding and investment partners\n* Collaboration with academia and industry experts\n* Events and workshops on entrepreneurship and innovation\n\nI hope this information helps Let me know if you have any further questions."
}
```

This setup allows you to use the HybridRetriever class in a FastAPI application and interact with it via Postman.
## References
- [Demo link for API](https://i-venture-chatbot.onrender.com)
- [Postman Docs](https://learning.postman.com/docs/sending-requests/create-requests/create-requests/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/reference/fastapi/)
