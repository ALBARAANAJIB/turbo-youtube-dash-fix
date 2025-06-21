
const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            YouTube Extension Dashboard
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            This is the web interface for the YouTube Chrome Extension.
          </p>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Chrome Extension Features
            </h2>
            <ul className="text-left space-y-2 text-gray-600">
              <li>• AI-powered video summarization</li>
              <li>• Liked videos management</li>
              <li>• Direct YouTube integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
