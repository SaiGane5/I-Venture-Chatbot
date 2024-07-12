import os
import openai
from llama_index.core import SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core import ServiceContext, VectorStoreIndex
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import load_index_from_storage
from llama_index.core import StorageContext

def indexgenerator(indexPath, documentsPath):

    # check if storage already exists
    if not os.path.exists(indexPath):
        print("Not existing")
        # load the documents and create the index
        
        #entity_extractor = EntityExtractor(prediction_threshold=0.2,label_entities=False, device="cpu")

        node_parser = SentenceSplitter(chunk_overlap=200,chunk_size=2000)

        transformations = [node_parser]

        documents = SimpleDirectoryReader(input_dir=r"scraped_files\processed\striped_files").load_data()

        pipeline = IngestionPipeline(transformations=transformations)

        nodes = pipeline.run(documents=documents)

        service_context = ServiceContext.from_defaults(llm=OpenAI(model="gpt-3.5-turbo", temperature=0))

        index = VectorStoreIndex(nodes, service_context=service_context)

        # store it for later
        index.storage_context.persist(indexPath)
    else:
        #load existing index
        print("Existing")
        storage_context = StorageContext.from_defaults(persist_dir=indexPath)
        index = load_index_from_storage(storage_context,llm=OpenAI(model="gpt-3.5-turbo", temperature=0, system_prompt="You are an expert on I-Venture @ ISB and your job is to answer technical questions. Assume that all questions are related to I-Venture @ ISB. Keep your answers technical and based on facts – do not hallucinate features."),embed_model=OpenAIEmbedding(model="text-embedding-ada-002"))
        
    return index
