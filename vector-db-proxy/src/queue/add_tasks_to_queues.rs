use std::collections::HashMap;
use crate::queue::queuing::{Control, MyQueue};
use mongodb::Database;
use qdrant_client::client::QdrantClient;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Adds the incoming task to the execution Queue to be processes when threads are available
pub async fn add_message_to_embedding_upserting_queue(
    queue: Arc<RwLock<MyQueue<String>>>,
    qdrant_conn: Arc<RwLock<QdrantClient>>,
    mongo_conn: Arc<RwLock<Database>>,
    params: (String, String),
) {
    let (dataset_id, table_name) = params;
    // Instantiate a new instance of the MyQueue
    let mut q_guard = queue.write().await;
    // Add task to queue
    q_guard.enqueue(dataset_id);
    // Call associated function to being processing tasks in the queue
    q_guard.embed_upsert_message(qdrant_conn, mongo_conn, table_name);
}

pub async fn add_message_to_upsert_queue(
    queue: Arc<RwLock<MyQueue<String>>>,
    qdrant_conn: Arc<RwLock<QdrantClient>>,
    mongo_conn: Arc<RwLock<Database>>,
    vector: Vec<Vec<f32>>,
    metadata: HashMap<String, String>,
) {
    todo!()
}

pub async fn add_message_to_embedding_queue(
    queue: Arc<RwLock<MyQueue<String>>>,
    qdrant_conn: Arc<RwLock<QdrantClient>>,
    mongo_conn: Arc<RwLock<Database>>,
    vector: Vec<Vec<f32>>,
    metadata: HashMap<String, String>,
) {
    todo!()
}