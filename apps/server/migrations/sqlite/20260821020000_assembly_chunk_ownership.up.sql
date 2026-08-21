CREATE TABLE assembly_job_chunks (
    job_id   INTEGER NOT NULL REFERENCES assembly_jobs(id) ON DELETE CASCADE,
    checksum TEXT NOT NULL REFERENCES chunk(checksum) ON DELETE RESTRICT,
    PRIMARY KEY (job_id, checksum)
);
CREATE INDEX idx_assembly_job_chunks_checksum ON assembly_job_chunks(checksum);

INSERT INTO assembly_job_chunks(job_id, checksum)
SELECT jobs.id, json_each.value
FROM assembly_jobs jobs, json_each(jobs.chunks)
JOIN chunk ON chunk.checksum = json_each.value
WHERE jobs.state <> 'ok';
