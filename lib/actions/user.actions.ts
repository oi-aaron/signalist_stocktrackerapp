import { connectToDatabase } from "@/database/mongoose";
import { email } from "better-auth";

export const getAllUsersForNewsEmail = async () => {
    try{
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Database connection not established');

        const users = await db.collection('users').find(
            { email: { $exists: true, $ne: null } },
            { projection: { _id: 1, id: 1, email: 1, name: 1, country: 1 } }
        ).toArray();

        return users.filter((user) => user.email && user.name ).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name,
        }));
    }catch(e){
        console.log('Failed to fetch users for news email', e)
        return []
    }
}