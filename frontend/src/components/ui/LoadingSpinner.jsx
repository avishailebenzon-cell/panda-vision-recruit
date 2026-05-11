export default function LoadingSpinner({ message = "טוען נתונים..." }) {
  return (
    <div className="h-full w-full flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
}