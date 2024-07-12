from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import openai
import pandas as pd
import logging
import json
from llama_index.core.base.llms.types import ChatMessage, MessageRole
from rouge import Rouge
from llama_index.llms.openai import OpenAI
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.retrievers.bm25 import BM25Retriever
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.schema import QueryBundle
from llama_index.core.schema import MetadataMode
from llama_index.core.postprocessor import LongContextReorder 
from llama_index.core.chat_engine import CondensePlusContextChatEngine
from llama_index.core.retrievers import BaseRetriever
from llama_index.embeddings.openai import OpenAIEmbedding
from create_context import answer_question
from qa_llamaindex import indexgenerator

app = FastAPI()
port = os.environ.get('PORT', 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load necessary models and components
indexPath_2000 = r"updated_data_28_06_2024"
documentsPath_2000 = r"striped_new"
index_2000 = indexgenerator(indexPath_2000, documentsPath_2000)
vector_retriever_2000 = VectorIndexRetriever(index=index_2000, similarity_top_k=2, embed_model=OpenAIEmbedding(model="text-embedding-ada-002"))
bm25_retriever_2000 = BM25Retriever.from_defaults(index=index_2000, similarity_top_k=2)
postprocessor = LongContextReorder()
rouge = Rouge()

class HybridRetriever(BaseRetriever):
    def __init__(self, vector_retriever, bm25_retriever):
        self.vector_retriever = vector_retriever
        self.bm25_retriever = bm25_retriever
        super().__init__()

    def _retrieve(self, query, **kwargs):
        bm25_nodes = self.bm25_retriever.retrieve(query, **kwargs)
        vector_nodes = self.vector_retriever.retrieve(query, **kwargs)
        all_nodes = bm25_nodes + vector_nodes
        all_nodes = postprocessor.postprocess_nodes(nodes=all_nodes, query_bundle=QueryBundle(query))
        return all_nodes

hybrid_retriever = HybridRetriever(vector_retriever_2000, bm25_retriever_2000)
memory = ChatMemoryBuffer.from_defaults(token_limit=3900)

RAG_PROMPT_TEMPLATE = """
You are an artificial intelligence assistant designed to help answer questions related to I-Venture at ISB or DLabs ISB.
The following is a friendly conversation between a user and an AI assistant for answering questions related to query.
The assistant is talkative and provides lots of specific details in form of bullet points or short paras from the context.
Here is the relevant context:

{context_str}

Instruction: Based on the above context and web response giving more weightage to the web response, provide a detailed answer IN THE USER'S LANGUAGE with logical formation of paragraphs for the user question below.
"""
condense_prompt = "Given the following conversation between a user and an AI assistant and a follow up question from user, rephrase the follow up question to be a standalone question.\nChat History:\n{chat_history}\nFollow Up Input: {question}\nStandalone question:"

class ChatRequest(BaseModel):
    prompt: str
    message_history: list

class WebSocketResponse(BaseModel):
    content: str

@app.post('/api/chat')
async def chat(request: ChatRequest):
    prompt = request.prompt
    message_history = request.message_history

    response, context_str = get_response(prompt=prompt, message_history=message_history)
    web_answer = get_web_answer(prompt, context_str)

    return {"rag_response": response[0], "web_response": web_answer}

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            prompt = data['prompt']
            message_history = data['message_history']

            # Stream responses
            async for response in stream_response(prompt, message_history):
                await websocket.send_json(WebSocketResponse(content=response).dict())
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")

async def stream_response(prompt, message_history):
    llm_chat = OpenAI(model="gpt-3.5-turbo", temperature=0)
    chat_engine = CondensePlusContextChatEngine.from_defaults(
        llm=llm_chat, retriever=hybrid_retriever, 
        context_prompt=RAG_PROMPT_TEMPLATE, condense_prompt=condense_prompt, streaming=True
    )
    nodes = hybrid_retriever.retrieve(prompt.lower())
    response = chat_engine.chat(str(prompt.lower()))

    # Check if the response is iterable
    if hasattr(response, '__iter__') and not isinstance(response, str):
        for chunk in response:
            yield str(chunk)
    else:
        yield str(response)

def get_response(prompt, message_history):
    try:
        llm_chat = OpenAI(model="gpt-3.5-turbo", temperature=0)
        chat_engine = CondensePlusContextChatEngine.from_defaults(
            llm=llm_chat, retriever=hybrid_retriever, 
            context_prompt=RAG_PROMPT_TEMPLATE, condense_prompt=condense_prompt, streaming=True
        )
        nodes = hybrid_retriever.retrieve(prompt.lower())
        response = chat_engine.chat(str(prompt.lower()))
        context_str = "\n\n".join([n.node.get_content(metadata_mode=MetadataMode.LLM).strip() for n in response.source_nodes])

        feedback_prompt = f"""
        You are an intelligent bot designed to assist users on an organization's website by answering their queries. You'll be given a user's question and an associated answer. Your task is to determine if the provided answer effectively resolves the query. If the answer is unsatisfactory, return 0.
        Query: {prompt}
        Answer: {response.response}
        Your Feedback:"""
        feedback = OpenAI(model="gpt-3.5-turbo").complete(feedback_prompt.format(question=prompt, answer=response.response))

        if feedback.text == str(0):
            response, joined_text = answer_question(prompt.lower())
            scores = rouge.get_scores(response, joined_text)
            return [response, prompt, scores], joined_text
        else:
            context_str = "\n\n".join([n.node.get_content(metadata_mode=MetadataMode.LLM).strip() for n in nodes])
            scores = rouge.get_scores(response.response, context_str)
            return [response.response, prompt, scores], context_str
    except KeyError as e:
        logger.error(f"KeyError in get_response: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

def get_web_answer(question, context_from_rag):
    client = openai.OpenAI(api_key=os.environ.get('PPLX_KEY'), base_url="https://api.perplexity.ai")
    prompt = f"""
    You are a helpful and friendly chatbot who addresses queries in detail and bulleted points regarding I-Venture @ ISB.
    Here's the question:
    {question} I-Venture ISB
    Here's the relevant information.
    {context_from_rag}
    If the relevant information is inadequate use web sources as your information pool.
    Rely heavily on information received from the web. Be verbose.
    """
    messages = [{"role": "user", "content": prompt}]
    response = client.chat.completions.create(model="llama-3-sonar-large-32k-online", messages=messages)
    return response.choices[0].message.content

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=port)