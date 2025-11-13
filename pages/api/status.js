import fs from 'fs';
import path from 'path';


export default function handler(req, res){
const jobId = req.query.jobId;
if (!jobId) return res.status(400).json({ error: 'jobId required' });
const p = path.join(process.cwd(), 'jobs', `${jobId}.json`);
if (!fs.existsSync(p)) return res.status(404).json({ error: 'job not found' });
const job = JSON.parse(fs.readFileSync(p,'utf8'));
return res.status(200).json(job);
}