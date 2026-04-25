
export const Loader = ({ message = "Loading..." }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-indigo-400 animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "0.8s" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 tracking-wide">{message}</p>
        <div className="flex justify-center gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
    <p className="absolute bottom-6 text-xs text-gray-300 tracking-widest uppercase">
      NeuroClinic Management
    </p>
  </div>
);

export const InlineLoader = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-16">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
    </div>
    {message && <p className="text-sm text-gray-500 font-medium">{message}</p>}
  </div>
);

export default Loader;
