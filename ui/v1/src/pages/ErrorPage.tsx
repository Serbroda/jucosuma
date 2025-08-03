import { useRouteError } from "react-router-dom";

const ErrorPage = () => {
    const error: any = useRouteError();
    console.error(error);

    return (
        <div id="error-page" className="flex flex-col items-center justify-center">
            <h1 className="text-6xl py-4 font-bold">{error.status}</h1>
            <h2 className="text-3xl">{error.data}</h2>
            <p>
                {error.statusText}
            </p>
        </div>
    );
};

export default ErrorPage;