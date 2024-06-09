import pidusage from "pidusage";
import {pid} from "process";

export function monitorUsage(pid:number):void {
    setInterval(() => {
        pidusage(pid, (err: Error, stats: pidusage.Status) => {
            if(err) {
                console.error(err);
                return;
            }

            console.log(`CPU: ${stats.cpu.toFixed(2)}%`);
            console.log(`Memory: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Uptime: ${process.uptime().toFixed(2)} s`);
            console.log('--------------------------------------------');
        }) 
    },2000);
}
