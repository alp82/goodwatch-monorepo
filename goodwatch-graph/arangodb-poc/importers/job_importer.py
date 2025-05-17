"""
Job importer for importing job data from JSON.
"""
from importers.static_data_importer import StaticDataImporter
from utils.key_generators import make_human_key

class JobImporter(StaticDataImporter):
    """
    Importer for job and department data from jobs.json.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the job importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.collections = ['departments', 'jobs']
        self.edge_collections = ['belongs_to_department', 'has_job']
        self._init_batch_buffers(self.collections, self.edge_collections)
        
    def import_jobs(self):
        """
        Import jobs and departments from the jobs.json file.
        
        Returns:
            dict: Number of imported departments and jobs
        """
        print("\nImporting jobs and departments...")
        
        # Ensure collections exist
        self._ensure_collections_exist(self.collections, self.edge_collections)
        
        # Load job data
        jobs_data = self._load_json_data('jobs.json')
        
        # Process departments and jobs
        for department_data in jobs_data:
            self._process_department(department_data)
            
        # Commit any remaining batch items
        for collection in self.collections:
            self._commit_batch(collection, self.batch_docs[collection])
            
        for edge in self.edge_collections:
            self._commit_batch(edge, self.batch_edges[edge], is_edge=True)
            
        # Print stats
        total_departments = self.stats['documents']['departments']
        total_jobs = self.stats['documents']['jobs']
        print(f"Imported {total_departments} departments and {total_jobs} jobs")
        
        return {
            'departments': total_departments,
            'jobs': total_jobs
        }
        
    def _process_department(self, department_data):
        """
        Process a department item from the JSON data.
        
        Args:
            department_data: Dictionary with department data
        """
        department_name = department_data.get('department')
        jobs_list = department_data.get('jobs', [])
        
        if not department_name:
            print(f"Skipping department without name: {department_data}")
            return
            
        # Create department document
        department_key = make_human_key(department_name)
        department_doc = {
            '_key': department_key,
            'name': department_name
        }
        
        # Add department to batch
        self.batch_docs['departments'].append(department_doc)
        
        # Process jobs for this department
        for job_name in jobs_list:
            self._process_job(job_name, department_key)
            
        # Commit batch if needed
        if len(self.batch_docs['departments']) >= 100:
            self._commit_batch('departments', self.batch_docs['departments'])
            
    def _process_job(self, job_name, department_key):
        """
        Process a job item from the department data.
        
        Args:
            job_name: Name of the job
            department_key: Key of the department this job belongs to
        """
        if not job_name:
            return
            
        # Create job document
        job_key = make_human_key(job_name)
        job_doc = {
            '_key': job_key,
            'name': job_name
        }
        
        # Add job to batch
        self.batch_docs['jobs'].append(job_doc)
        
        # Create edge from job to department
        job_dept_edge = {
            '_from': f'jobs/{job_key}',
            '_to': f'departments/{department_key}'
        }
        self.batch_edges['belongs_to_department'].append(job_dept_edge)
        
        # Commit batches if needed
        if len(self.batch_docs['jobs']) >= 100:
            self._commit_batch('jobs', self.batch_docs['jobs'])
            
        if len(self.batch_edges['belongs_to_department']) >= 100:
            self._commit_batch('belongs_to_department', self.batch_edges['belongs_to_department'], is_edge=True)
