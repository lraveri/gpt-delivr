export const config = {
    runtime: "edge",
};

const handler = async (req) => {

    return new Response("Hello, World!");
};

export default handler;