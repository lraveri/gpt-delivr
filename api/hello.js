export const config = {
    runtime: 'edge', // this is a pre-requisite
};

export default async function handler(req, res) {
    res.json({ message: 'Hello' });
}