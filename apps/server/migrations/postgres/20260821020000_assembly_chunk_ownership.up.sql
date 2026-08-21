CREATE TABLE assembly_job_chunks (
    job_id   BIGINT NOT NULL REFERENCES assembly_jobs(id) ON DELETE CASCADE,
    checksum CHAR(40) NOT NULL REFERENCES chunk(checksum) ON DELETE RESTRICT,
    PRIMARY KEY (job_id, checksum)
);
CREATE INDEX idx_assembly_job_chunks_checksum ON assembly_job_chunks(checksum);

INSERT INTO assembly_job_chunks(job_id, checksum)
SELECT jobs.id, chunks.checksum
FROM assembly_jobs jobs
CROSS JOIN LATERAL unnest(jobs.chunks) AS chunks(checksum)
JOIN chunk ON chunk.checksum = chunks.checksum
WHERE jobs.state <> 'ok';
