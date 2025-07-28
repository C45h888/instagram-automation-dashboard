@@ .. @@
       {/* Sparkline placeholder */}
       <div className="h-6 mt-1 flex items-end gap-0.5">
         {sparkline_data.slice(-16).map((v, i) => (
           <div
             key={i}
             className="w-1 rounded bg-gradient-to-t from-blue-500 via-blue-400 to-blue-300"
             style={{ height: `${Math.max(2, v)}px` }}
           />
         ))}
       </div>