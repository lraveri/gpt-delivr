export default async function handler(req) {
    return new Response(JSON.stringify({ message: 'Server healthy' }), {
        headers: { 'Content-Type': 'application/json' },
    });
}