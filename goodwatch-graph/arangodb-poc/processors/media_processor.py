"""
Processor for handling media (images and videos).
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class MediaProcessor(BaseProcessor):
    """
    Processor for handling media assets like images and videos.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the media processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_images(self, doc, id_prefix):
        """
        Process images for a document and create related edges.
        
        Args:
            doc: Main document with images
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (image_docs, image_edges)
        """
        images = parse_json_field(doc.get('images'))
        image_docs = []
        image_edges = []
        
        if not isinstance(images, dict):
            return image_docs, image_edges
            
        for img_type, img_list in images.items():
            for i, img in enumerate(img_list or []):
                img_key = make_human_key(doc['_key'], img_type, img.get('file_path') or i)
                
                # Create image document
                idoc = dict(img)
                idoc['_key'] = img_key
                idoc['type'] = img_type
                idoc['parent_key'] = doc['_key']
                
                image_docs.append(idoc)
                self.add_to_batch('images', idoc)
                
                # Create edge from main doc to image
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"images/{img_key}"
                }
                image_edges.append(edge)
                self.add_edge('has_image', f"{id_prefix}/{doc['_key']}", f"images/{img_key}")
                
        return image_docs, image_edges
        
    def process_videos(self, doc, id_prefix):
        """
        Process videos for a document and create related edges.
        
        Args:
            doc: Main document with videos
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (video_docs, video_edges)
        """
        videos = parse_json_field(doc.get('videos'))
        video_docs = []
        video_edges = []
        
        if not isinstance(videos, dict):
            return video_docs, video_edges
            
        for vid_type, vid_list in videos.items():
            for i, vid in enumerate(vid_list or []):
                vid_key = make_human_key(doc['_key'], vid_type, vid.get('id') or vid.get('key') or i)
                
                # Create video document
                vdoc = dict(vid)
                vdoc['_key'] = vid_key
                vdoc['type'] = vid_type
                vdoc['parent_key'] = doc['_key']
                
                video_docs.append(vdoc)
                self.add_to_batch('videos', vdoc)
                
                # Create edge from main doc to video
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"videos/{vid_key}"
                }
                video_edges.append(edge)
                self.add_edge('has_video', f"{id_prefix}/{doc['_key']}", f"videos/{vid_key}")
                
        return video_docs, video_edges
