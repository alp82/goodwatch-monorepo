"""
Processor for handling persons (cast and crew).
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class PersonProcessor(BaseProcessor):
    """
    Processor for handling persons, including cast and crew.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the person processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_persons(self, doc, id_prefix):
        """
        Process cast and crew for a document and create related edges.
        
        Args:
            doc: Main document with cast and crew data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (person_docs, appearance_edges, work_edges)
        """
        cast = parse_json_field(doc.get('cast'))
        crew = parse_json_field(doc.get('crew'))
        
        person_docs = []
        appearance_edges = []
        work_edges = []
        
        # Track inserted persons to avoid duplicates
        inserted_persons = set()
        
        # Process cast members
        for cast_member in cast:
            pname = cast_member.get('name')
            pid = cast_member.get('id')
            
            if not pname or not pid:
                continue
                
            person_key = make_human_key(pname, pid)
            
            # Skip if already processed
            if person_key in inserted_persons:
                continue
                
            inserted_persons.add(person_key)
            person_id = f"persons/{person_key}"
            
            # Create person document
            person_doc = {
                '_key': person_key,
                'name': pname,
                'tmdb_id': pid,
                'profile_path': cast_member.get('profile_path')
            }
            person_docs.append(person_doc)
            self.add_to_batch('persons', person_doc)
            
            # Create edge from person to movie/show
            edge = {
                '_from': person_id,
                '_to': f"{id_prefix}/{doc['_key']}",
                'character': cast_member.get('character'),
                'order': cast_member.get('order')
            }
            appearance_edges.append(edge)
            self.add_edge('appeared_in', person_id, f"{id_prefix}/{doc['_key']}", 
                         character=cast_member.get('character'), 
                         order=cast_member.get('order'))
            
            # Connect person to Job (Actor)
            job_key = make_human_key('Actor')
            self.add_edge('performed_job', person_id, f"jobs/{job_key}", 
                         role=cast_member.get('character'))
            
        # Process crew members
        for crew_member in crew:
            pname = crew_member.get('name')
            pid = crew_member.get('id')
            
            if not pname or not pid:
                continue
                
            person_key = make_human_key(pname, pid)
            
            # Skip if already processed
            if person_key in inserted_persons:
                continue
                
            inserted_persons.add(person_key)
            person_id = f"persons/{person_key}"
            
            # Create person document
            person_doc = {
                '_key': person_key,
                'name': pname,
                'tmdb_id': pid,
                'profile_path': crew_member.get('profile_path')
            }
            person_docs.append(person_doc)
            self.add_to_batch('persons', person_doc)
            
            # Create edge from person to movie/show
            edge = {
                '_from': person_id,
                '_to': f"{id_prefix}/{doc['_key']}",
                'job': crew_member.get('job'),
                'department': crew_member.get('department'),
                'order': crew_member.get('order')
            }
            work_edges.append(edge)
            self.add_edge('worked_on', person_id, f"{id_prefix}/{doc['_key']}", 
                         job=crew_member.get('job'), 
                         department=crew_member.get('department'),
                         order=crew_member.get('order'))
            
            # Connect person to Job based on their job type
            job_name = crew_member.get('job')
            if job_name:
                job_key = make_human_key(job_name)
                self.add_edge('performed_job', person_id, f"jobs/{job_key}", 
                             department=crew_member.get('department'))
            
        return person_docs, appearance_edges, work_edges
